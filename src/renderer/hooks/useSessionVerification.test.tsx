// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSessionVerification } from './useSessionVerification';

describe('useSessionVerification', () => {
  it('loads backend routes once after a successful verification', async () => {
    const listRoutes = vi.fn(async () => ({ routes: [] }));
    const options = {
      hasHydrated: true,
      token: 'opaque-token',
      refreshToken: 'refresh-token',
      isOffline: false,
      clearSession: vi.fn(),
      setTokens: vi.fn(),
      setSession: vi.fn(),
      updateRoutesOrder: vi.fn(),
      getActiveTab: vi.fn(() => null),
      setActiveTab: vi.fn(),
      setOfflineMode: vi.fn(),
      hasCachedWorkspace: vi.fn(() => false),
      refreshSession: vi.fn(),
      getCurrentUser: vi.fn(async () => ({
        user: { id: 'user-1', email: 'user@example.com' },
      })),
      listRoutes,
      createLocalRoute: vi.fn(),
    };

    const { result } = renderHook(() => useSessionVerification(options));

    await waitFor(() => {
      expect(result.current.verifiedToken).toBe('opaque-token');
    });
    await act(async () => {
      for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
      }
    });

    expect(listRoutes).toHaveBeenCalledOnce();
  });
});
