// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addRoute: vi.fn(),
  navigate: vi.fn(),
  setActiveDrawer: vi.fn(),
  setActiveTab: vi.fn(),
}));

vi.mock('@heroui/react', () => ({
  Button: ({ children, isDisabled, ...props }: React.PropsWithChildren<{ isDisabled?: boolean }>) => (
    <button disabled={isDisabled} {...props}>{children}</button>
  ),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../store', () => ({
  useAppStore: () => ({
    addRoute: mocks.addRoute,
    setActiveDrawer: mocks.setActiveDrawer,
    setActiveTab: mocks.setActiveTab,
  }),
}));

import CreateNewRouteForm from './CreateNewRouteForm';

const renderForm = (props: Partial<React.ComponentProps<typeof CreateNewRouteForm>> = {}) =>
  render(<CreateNewRouteForm closeDrawer={vi.fn()} {...props} />);

const fillRoute = (label: string, url: string) => {
  fireEvent.change(screen.getByPlaceholderText('Work Gmail'), {
    target: { value: label },
  });
  fireEvent.change(screen.getByPlaceholderText('mail.google.com'), {
    target: { value: url },
  });
};

describe('CreateNewRouteForm', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(window, {
      electronAPI: { invoke: vi.fn(async () => ({ success: true })) },
    });
  });

  it('creates a normalized route through the supplied callback', async () => {
    const closeDrawer = vi.fn();
    const onCreateRoute = vi.fn(async () => true);
    renderForm({ closeDrawer, onCreateRoute });
    fillRoute(' Work Gmail ', 'mail.google.com');

    fireEvent.submit(screen.getByRole('button', { name: 'Save route' }).closest('form')!);

    await waitFor(() => {
      expect(onCreateRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Work Gmail',
          loadURL: 'https://mail.google.com',
          icon: 'gmail',
        }),
      );
      expect(closeDrawer).toHaveBeenCalledOnce();
    });
  });

  it('shows a validation error for an invalid URL', async () => {
    renderForm();
    fillRoute('Broken', 'http://[');

    fireEvent.submit(screen.getByRole('button', { name: 'Save route' }).closest('form')!);

    expect(await screen.findByText('Enter a valid URL.')).toBeTruthy();
  });

  it('updates local route state after Electron creates the route', async () => {
    const closeDrawer = vi.fn();
    renderForm({ closeDrawer });
    fillRoute('Work Discord', 'discord.com/channels/@me');
    fireEvent.change(screen.getByDisplayValue('Gmail'), {
      target: { value: 'discord' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Save route' }).closest('form')!);

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(
        'create-route-view',
        expect.objectContaining({ route: expect.objectContaining({ icon: 'discord' }) }),
      );
      expect(mocks.addRoute).toHaveBeenCalledOnce();
      expect(mocks.setActiveDrawer).toHaveBeenCalledWith(null);
      expect(closeDrawer).toHaveBeenCalledOnce();
    });
  });
});
