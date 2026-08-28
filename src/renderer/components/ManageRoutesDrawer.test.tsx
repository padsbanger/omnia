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
  navigate: vi.fn(),
  store: {
    removeRoute: vi.fn(),
    setActiveTab: vi.fn(),
    setRouteHibernation: vi.fn(),
    setWindowLayout: vi.fn(),
    updateRouteLabel: vi.fn(),
    updateUnreadCount: vi.fn(),
  },
}));

vi.mock('@heroui/react', () => {
  const Button = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  );
  const Tooltip = Object.assign(
    ({ children }: React.PropsWithChildren) => <>{children}</>,
    { Content: ({ children }: React.PropsWithChildren) => <>{children}</> },
  );

  return {
    Button,
    Description: ({ children }: React.PropsWithChildren) => (
      <div>{children}</div>
    ),
    Label: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
    Tooltip,
  };
});

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../store', () => ({
  useAppStore: () => ({
    routes: [],
    activeTab: null,
    windowLayout: 'single',
    ...mocks.store,
  }),
}));
vi.mock('./WindowIcon', () => ({ WindowIcon: () => <span>icon</span> }));
vi.mock('react-icons/md', () => ({
  MdAdd: () => <span>add</span>,
  MdDeleteOutline: () => <span>delete</span>,
  MdDeleteSweep: () => <span>clear</span>,
  MdEdit: () => <span>edit</span>,
  MdOutlineBedtime: () => <span>hibernate</span>,
  MdPlayArrow: () => <span>restore</span>,
  MdRefresh: () => <span>refresh</span>,
  MdRemove: () => <span>remove</span>,
}));

import ManageRoutesDrawer from './ManageRoutesDrawer';

const createRoute = (overrides: Partial<Route> = {}): Route => ({
  id: 'route-1',
  path: '/route-1',
  icon: 'link',
  label: 'Route 1',
  loadURL: 'https://route-1.example.com',
  partition: 'persist:route-1',
  ...overrides,
});

const renderDrawer = (
  props: Partial<React.ComponentProps<typeof ManageRoutesDrawer>> = {},
) =>
  render(
    <ManageRoutesDrawer
      closeDrawer={vi.fn()}
      routes={[
        createRoute(),
        createRoute({ id: 'route-2', path: '/route-2', label: 'Route 2' }),
      ]}
      activeTab="route-1"
      windowLayout="single"
      {...props}
    />,
  );

describe('ManageRoutesDrawer', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(window, {
      electronAPI: { invoke: vi.fn(async () => ({ success: true })) },
    });
  });

  it('delegates hibernation and deletion when drawer callbacks are supplied', async () => {
    const onToggleHibernation = vi.fn(async () => undefined);
    const onDeleteRoute = vi.fn(async () => undefined);
    renderDrawer({ onToggleHibernation, onDeleteRoute });

    fireEvent.click(screen.getAllByRole('button', { name: 'Hibernate' })[0]);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete route' }).at(-1)!,
    );

    await waitFor(() => {
      expect(onToggleHibernation).toHaveBeenCalledWith('route-1');
      expect(onDeleteRoute).toHaveBeenCalledWith('route-2');
    });
  });

  it('hibernates an active route through Electron and clears its unread count', async () => {
    renderDrawer();
    fireEvent.click(screen.getAllByRole('button', { name: 'Hibernate' })[0]);

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(
        'hibernate-route-view',
        expect.objectContaining({
          route: expect.objectContaining({ id: 'route-1' }),
        }),
      );
      expect(mocks.store.setRouteHibernation).toHaveBeenCalledWith(
        'route-1',
        true,
      );
      expect(mocks.store.updateUnreadCount).toHaveBeenCalledWith('route-1', 0);
    });
  });

  it('changes and displays the zoom for only the selected route', async () => {
    (window.electronAPI.invoke as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ success: true, zoomLevel: 1 })
      .mockResolvedValueOnce({ success: true, zoomLevel: -1 });
    renderDrawer({
      routes: [
        createRoute(),
        createRoute({ id: 'route-2', path: '/route-2', label: 'Route 2' }),
      ],
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Zoom in' })[1]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Zoom out' })[0]);

    expect(window.electronAPI.invoke).toHaveBeenCalledWith(
      'change-route-zoom',
      {
        route: expect.objectContaining({ id: 'route-2' }),
        direction: 'in',
      },
    );
    await waitFor(() => {
      expect(screen.getByText('120%')).toBeTruthy();
      expect(screen.getByText('83%')).toBeTruthy();
    });
    expect(window.electronAPI.invoke).toHaveBeenCalledWith(
      'change-route-zoom',
      {
        route: expect.objectContaining({ id: 'route-1' }),
        direction: 'out',
      },
    );
  });

  it('restores a hibernated active route and activates it in the single layout', async () => {
    renderDrawer({ routes: [createRoute({ isHibernated: true })] });
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(mocks.store.setRouteHibernation).toHaveBeenCalledWith(
        'route-1',
        false,
      );
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(
        'activate-tab',
        expect.anything(),
      );
    });
  });

  it('keeps a hibernated route unchanged when Electron cannot recreate its view', async () => {
    (window.electronAPI.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
    });
    renderDrawer({ routes: [createRoute({ isHibernated: true })] });

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(
        'create-route-view',
        expect.anything(),
      );
    });
    expect(mocks.store.setRouteHibernation).not.toHaveBeenCalled();
  });

  it('deletes the active route, selects a fallback, and navigates to it', async () => {
    renderDrawer();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete route' })[0]);

    await waitFor(() => {
      expect(mocks.store.removeRoute).toHaveBeenCalledWith('route-1');
      expect(mocks.store.setActiveTab).toHaveBeenCalledWith('route-2');
      expect(mocks.navigate).toHaveBeenCalledWith('/route-2');
    });
  });

  it('deletes an inactive route without changing the selected route', async () => {
    renderDrawer();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete route' })[1]);

    await waitFor(() => {
      expect(mocks.store.removeRoute).toHaveBeenCalledWith('route-2');
    });
    expect(mocks.store.setActiveTab).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('validates and saves edited route labels', async () => {
    const onUpdateRouteLabel = vi.fn(async () => true);
    renderDrawer({ onUpdateRouteLabel });

    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]);
    const input = screen.getByDisplayValue('Route 1');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Route label cannot be empty.')).toBeTruthy();

    fireEvent.change(input, { target: { value: 'Renamed route' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onUpdateRouteLabel).toHaveBeenCalledWith(
        'route-1',
        'Renamed route',
      );
    });
  });

  it('keeps editing open and explains when the backend rejects a label change', async () => {
    const onUpdateRouteLabel = vi.fn(async () => false);
    renderDrawer({ onUpdateRouteLabel });

    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]);
    fireEvent.change(screen.getByDisplayValue('Route 1'), {
      target: { value: 'Blocked' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Failed to update route label.'),
    ).toBeTruthy();
  });

  it('closes the editor without saving when the label is unchanged', () => {
    renderDrawer();

    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByDisplayValue('Route 1')).toBeNull();
    expect(mocks.store.updateRouteLabel).not.toHaveBeenCalled();
  });

  it('shows the update error when saving a route label throws', async () => {
    const onUpdateRouteLabel = vi.fn(async () => {
      throw new Error('Network unavailable.');
    });
    renderDrawer({ onUpdateRouteLabel });

    fireEvent.click(screen.getAllByRole('button', { name: 'Rename' })[0]);
    fireEvent.change(screen.getByDisplayValue('Route 1'), {
      target: { value: 'Renamed route' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Network unavailable.')).toBeTruthy();
  });

  it('switches layouts through the supplied drawer callback', () => {
    const onWindowLayoutChange = vi.fn();
    renderDrawer({ onWindowLayoutChange });

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Matrix' }));

    expect(onWindowLayoutChange).toHaveBeenNthCalledWith(1, 'spread');
    expect(onWindowLayoutChange).toHaveBeenNthCalledWith(2, 'matrix');
  });

  it('shows offline guidance while preserving saved routes', () => {
    renderDrawer({ isOffline: true });

    expect(
      screen.getByText(/Offline mode: saved routes are available/),
    ).toBeTruthy();
  });

  it('uses the store-backed empty state when drawer route props are omitted', () => {
    render(<ManageRoutesDrawer closeDrawer={vi.fn()} />);

    expect(screen.getByText('No routes yet.')).toBeTruthy();
  });
});
