// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Route } from '../../common/routes';

const mocks = vi.hoisted(() => ({
  appState: {} as Record<string, unknown>,
  authState: {} as Record<string, unknown>,
  invoke: vi.fn(async (channel: string) =>
    channel === 'get-unread-state'
      ? {
          total: 2,
          unreadCounts: [{ routeId: 'route-1', count: 2 }],
          revision: 1,
        }
      : { success: true },
  ),
  onFromMain: vi.fn(() => vi.fn()),
}));

vi.mock('@heroui/react', () => {
  const Button = ({
    children,
    isDisabled,
    isIconOnly: _isIconOnly,
    ...props
  }: React.PropsWithChildren<
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      isDisabled?: boolean;
      isIconOnly?: boolean;
    }
  >) => (
    <button disabled={isDisabled} {...props}>
      {children}
    </button>
  );
  const Tooltip = Object.assign(
    ({ children }: React.PropsWithChildren) => <>{children}</>,
    { Content: ({ children }: React.PropsWithChildren) => <>{children}</> },
  );
  return { Button, Tooltip };
});
vi.mock('react-router-dom', () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../store', () => ({
  useAppStore: () => mocks.appState,
  useAuthStore: () => mocks.authState,
}));
vi.mock('../api/routes', () => ({ updateRoute: vi.fn() }));
vi.mock('./WindowIcon', () => ({ WindowIcon: () => <span>icon</span> }));
vi.mock('react-icons/md', () => ({
  MdAdd: () => <span>add</span>,
  MdLogout: () => <span>logout</span>,
  MdOutlineBedtime: () => <span>sleep</span>,
  MdTune: () => <span>manage</span>,
}));

import Sidemenu from './Sidemenu';

const route: Route = {
  id: 'route-1',
  path: '/route-1',
  icon: 'link',
  label: 'Route 1',
  loadURL: 'https://route-1.example.com',
  partition: 'persist:route-1',
};

const action = () => vi.fn();

describe('Sidemenu', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appState = {
      activeTab: 'route-1',
      isOffline: false,
      unreadCounts: { 'route-1': 2 },
      routes: [route],
      windowLayout: 'single',
      setActiveDrawer: action(),
      setActiveTab: action(),
      replaceUnreadCounts: action(),
      updateRouteMemoryUsage: action(),
      clearRoutes: action(),
      updateRoutesOrder: action(),
    };
    mocks.authState = {
      clearSession: action(),
      user: { email: 'user@example.com' },
      token: 'token',
    };
    Object.assign(window, {
      electronAPI: {
        invoke: mocks.invoke,
        onFromMain: mocks.onFromMain,
      },
    });
  });

  it('shows active routes, unread state, and drawer controls', async () => {
    render(<Sidemenu />);

    expect(screen.getByText('Route 1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage routes' }));

    await waitFor(() => {
      expect(mocks.appState.setActiveDrawer).toHaveBeenCalledWith('create');
      expect(mocks.appState.setActiveDrawer).toHaveBeenCalledWith('manage');
      expect(mocks.invoke).toHaveBeenCalledWith(
        'activate-tab',
        expect.anything(),
      );
      expect(document.title).toBe('(2) Omnia');
    });
  });

  it('represents offline and hibernated workspaces and logs out safely', async () => {
    mocks.appState = {
      ...mocks.appState,
      isOffline: true,
      routes: [{ ...route, isHibernated: true }],
      unreadCounts: {},
    };
    render(<Sidemenu />);

    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByText('sleep')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith('clear-route-views');
      expect(mocks.appState.clearRoutes).toHaveBeenCalledOnce();
      expect(mocks.authState.clearSession).toHaveBeenCalledOnce();
      expect(document.title).toBe('Omnia');
    });
  });

  it('reorders routes after a drag-and-drop action', async () => {
    const secondRoute = {
      ...route,
      id: 'route-2',
      path: '/route-2',
      label: 'Route 2',
    };
    mocks.appState = { ...mocks.appState, routes: [route, secondRoute] };
    render(<Sidemenu />);

    const firstRouteElement = screen
      .getByText('Route 1')
      .closest('a')?.parentElement;
    const secondRouteElement = screen
      .getByText('Route 2')
      .closest('a')?.parentElement;
    fireEvent.dragStart(firstRouteElement!);
    fireEvent.drop(secondRouteElement!);

    await waitFor(() => {
      expect(mocks.appState.updateRoutesOrder).toHaveBeenCalledWith([
        secondRoute,
        route,
      ]);
    });
  });
});
