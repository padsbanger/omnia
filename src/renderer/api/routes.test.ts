// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteRoute } from './routes';

describe('deleteRoute', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the delete request through Electron IPC', async () => {
    Object.assign(window, {
      electronAPI: { invoke: vi.fn(async () => ({ success: true })) },
    });

    await deleteRoute('access-token', 'route-1');

    expect(window.electronAPI.invoke).toHaveBeenCalledWith(
      'routes-delete',
      { token: 'access-token', routeId: 'route-1' },
    );
  });
});
