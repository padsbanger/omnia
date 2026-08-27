import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoute, deleteRoute, listRoutes, updateRoute } from './routeApi';

describe('route API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('deletes the requested route with the active access token', async () => {
    const fetch = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetch);

    await deleteRoute('access-token', 'route-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://omnia.pripyat.cloud/routes/route-1',
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer access-token' },
      }),
    );
  });

  it('surfaces the backend error message when deletion is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Route cannot be deleted.' }),
    })));

    await expect(deleteRoute('access-token', 'route-1')).rejects.toThrow(
      'Route cannot be deleted.',
    );
  });

  it('creates and updates routes with the expected JSON payloads', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ route: { id: 'route-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ route: { id: 'route-1', name: 'Renamed' } }),
      });
    vi.stubGlobal('fetch', fetch);

    await expect(createRoute('access-token', {
      name: 'Route 1',
      url: 'https://route-1.example.com',
    })).resolves.toEqual({ route: { id: 'route-1' } });
    await expect(updateRoute('access-token', 'route-1', {
      name: ' Renamed ',
      order: 2,
    })).resolves.toEqual({ route: { id: 'route-1', name: 'Renamed' } });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://omnia.pripyat.cloud/routes/route-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed', order: 2 }),
      }),
    );
  });

  it('rejects empty route updates and falls back to a status error message', async () => {
    await expect(updateRoute('access-token', 'route-1', {})).rejects.toThrow(
      'No route updates were provided.',
    );

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new Error('not JSON'); },
    })));

    await expect(createRoute('access-token', {
      name: 'Route 1',
      url: 'https://route-1.example.com',
    })).rejects.toThrow('Request failed with status 502');
  });

  it('retries route listing after a transient backend failure', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routes: [{ id: 'route-1' }] }),
      });
    vi.stubGlobal('fetch', fetch);

    const routes = listRoutes('access-token');
    await vi.advanceTimersByTimeAsync(750);

    await expect(routes).resolves.toEqual({ routes: [{ id: 'route-1' }] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
