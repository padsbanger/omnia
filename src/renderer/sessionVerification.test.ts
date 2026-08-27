import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRoute } from '../common/routeMapping';
import { Route } from '../common/routes';
import { AuthRequestError, AuthUser } from './api/auth';
import {
  completeInitialVerification,
  getTokenExpirationMs,
  handleSessionFailure,
  prepareSessionVerification,
  shouldShowAuthenticationLoader,
  TOKEN_REFRESH_LEEWAY_MS,
  verifyActiveSession,
} from './sessionVerification';

const user: AuthUser = { id: 'user-id', email: 'user@example.com' };

const apiRoute = (id: string, order: number): ApiRoute => ({
  id,
  userId: 'user-id',
  name: id,
  url: `https://${id}.example.com`,
  icon: 'link',
  order,
  metadata: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const localRoute = (route: ApiRoute): Route => ({
  id: route.id,
  label: route.name,
  icon: route.icon ?? 'link',
  path: `/${route.id}`,
  loadURL: route.url,
  partition: `persist:${route.id}`,
});

const createDependencies = () => ({
  token: 'opaque-token' as string,
  refreshToken: 'refresh-token' as string | null,
  now: vi.fn(() => 1_000_000),
  isMounted: vi.fn(() => true),
  refreshSession: vi.fn(),
  getCurrentUser: vi.fn(async () => ({ user })),
  listRoutes: vi.fn(async (): Promise<{ routes: ApiRoute[] }> => ({ routes: [] })),
  createLocalRoute: vi.fn(localRoute),
  setTokens: vi.fn(),
  setSession: vi.fn(),
  updateRoutesOrder: vi.fn(),
  getActiveTab: vi.fn((): string | null => null),
  setActiveTab: vi.fn(),
  setOfflineMode: vi.fn(),
  setVerifiedToken: vi.fn(),
  clearSession: vi.fn(),
});

const tokenWithExpiry = (expirationMs: number) => {
  const payload = Buffer.from(
    JSON.stringify({ exp: expirationMs / 1_000 }),
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${payload}.signature`;
};

describe('getTokenExpirationMs', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      atob: (value: string) => Buffer.from(value, 'base64').toString('utf8'),
    });
  });

  it('reads a numeric JWT expiration and rejects malformed payloads', () => {
    expect(getTokenExpirationMs(tokenWithExpiry(2_000_000))).toBe(2_000_000);
    expect(getTokenExpirationMs('header.eyJleHAiOiJub3BlIn0.signature')).toBeNull();
    expect(getTokenExpirationMs('not-a-jwt')).toBeNull();
  });
});

describe('session verification lifecycle', () => {
  const createStartDependencies = () => ({
    hasHydrated: true,
    hasToken: true,
    isReconnectAttempt: false,
    hasCompletedInitialVerification: false,
    resetInitialVerification: vi.fn(),
    setIsVerifying: vi.fn(),
    setVerifiedToken: vi.fn(),
    setOfflineMode: vi.fn(),
    clearSession: vi.fn(),
  });

  it('waits for hydration without changing session state', () => {
    const dependencies = createStartDependencies();
    dependencies.hasHydrated = false;

    expect(prepareSessionVerification(dependencies)).toBe(false);
    expect(dependencies.setVerifiedToken).not.toHaveBeenCalled();
  });

  it('clears the UI state when no token is available', () => {
    const dependencies = createStartDependencies();
    dependencies.hasToken = false;

    expect(prepareSessionVerification(dependencies)).toBe(false);
    expect(dependencies.resetInitialVerification).toHaveBeenCalledOnce();
    expect(dependencies.setVerifiedToken).toHaveBeenCalledWith(null);
    expect(dependencies.setOfflineMode).toHaveBeenCalledWith(false);
    expect(dependencies.setIsVerifying).toHaveBeenCalledWith(false);
  });

  it('starts a fresh verification while leaving reconnect state untouched', () => {
    const fresh = createStartDependencies();
    expect(prepareSessionVerification(fresh)).toBe(true);
    expect(fresh.setVerifiedToken).toHaveBeenCalledWith(null);
    expect(fresh.setIsVerifying).toHaveBeenCalledWith(true);

    const reconnect = createStartDependencies();
    reconnect.isReconnectAttempt = true;
    expect(prepareSessionVerification(reconnect)).toBe(true);
    expect(reconnect.setVerifiedToken).not.toHaveBeenCalled();
  });

  it('completes only the first mounted, non-reconnect verification', () => {
    const complete = vi.fn();
    completeInitialVerification({
      isMounted: () => true,
      isReconnectAttempt: false,
      hasCompletedInitialVerification: false,
      completeInitialVerification: complete,
    });
    expect(complete).toHaveBeenCalledOnce();

    completeInitialVerification({
      isMounted: () => false,
      isReconnectAttempt: false,
      hasCompletedInitialVerification: false,
      completeInitialVerification: complete,
    });
    completeInitialVerification({
      isMounted: () => true,
      isReconnectAttempt: true,
      hasCompletedInitialVerification: false,
      completeInitialVerification: complete,
    });
    expect(complete).toHaveBeenCalledOnce();
  });
});

describe('shouldShowAuthenticationLoader', () => {
  const state = {
    hasCompletedInitialVerification: false,
    hasHydrated: true,
    isOffline: false,
    isVerifying: false,
    token: 'token',
    verifiedToken: 'token',
  };

  it('blocks the UI while storage or the initial session check is pending', () => {
    expect(
      shouldShowAuthenticationLoader({ ...state, hasHydrated: false }),
    ).toBe(true);
    expect(
      shouldShowAuthenticationLoader({ ...state, isVerifying: true }),
    ).toBe(true);
    expect(
      shouldShowAuthenticationLoader({ ...state, verifiedToken: null }),
    ).toBe(true);
  });

  it('keeps cached offline workspaces and completed verification visible', () => {
    expect(
      shouldShowAuthenticationLoader({ ...state, isOffline: true, verifiedToken: null }),
    ).toBe(false);
    expect(
      shouldShowAuthenticationLoader({
        ...state,
        hasCompletedInitialVerification: true,
        isVerifying: true,
      }),
    ).toBe(false);
  });
});

describe('verifyActiveSession', () => {
  it('clears the session when an expiring token has no refresh token', async () => {
    const dependencies = createDependencies();
    dependencies.token = tokenWithExpiry(
      dependencies.now() + TOKEN_REFRESH_LEEWAY_MS,
    );
    dependencies.refreshToken = null;

    await verifyActiveSession(dependencies);

    expect(dependencies.clearSession).toHaveBeenCalledOnce();
    expect(dependencies.setOfflineMode).toHaveBeenCalledWith(false);
    expect(dependencies.setVerifiedToken).toHaveBeenCalledWith(null);
  });

  it('refreshes an expiring token without loading routes', async () => {
    const dependencies = createDependencies();
    dependencies.token = tokenWithExpiry(
      dependencies.now() + TOKEN_REFRESH_LEEWAY_MS - 1,
    );
    dependencies.refreshSession.mockResolvedValue({
      token: 'new-token',
      refreshToken: 'new-refresh-token',
    });

    await verifyActiveSession(dependencies);

    expect(dependencies.refreshSession).toHaveBeenCalledWith('refresh-token');
    expect(dependencies.setTokens).toHaveBeenCalledWith(
      'new-token',
      'new-refresh-token',
    );
    expect(dependencies.getCurrentUser).not.toHaveBeenCalled();
  });

  it('stops after refresh when the renderer has unmounted', async () => {
    const dependencies = createDependencies();
    dependencies.token = tokenWithExpiry(1);
    dependencies.isMounted.mockReturnValue(false);
    dependencies.refreshSession.mockResolvedValue({
      token: 'new-token',
      refreshToken: null,
    });

    await verifyActiveSession(dependencies);

    expect(dependencies.setTokens).not.toHaveBeenCalled();
  });

  it('loads routes in server order and selects the first valid route', async () => {
    const dependencies = createDependencies();
    dependencies.listRoutes.mockResolvedValue({
      routes: [apiRoute('second', 2), apiRoute('first', 1)],
    });

    await verifyActiveSession(dependencies);

    expect(dependencies.setSession).toHaveBeenCalledWith('opaque-token', user);
    expect(dependencies.updateRoutesOrder).toHaveBeenCalledWith([
      localRoute(apiRoute('first', 1)),
      localRoute(apiRoute('second', 2)),
    ]);
    expect(dependencies.setActiveTab).toHaveBeenCalledWith('first');
    expect(dependencies.setOfflineMode).toHaveBeenCalledWith(false);
    expect(dependencies.setVerifiedToken).toHaveBeenCalledWith('opaque-token');
  });

  it('preserves a valid active route and stops before route state updates after unmount', async () => {
    const dependencies = createDependencies();
    dependencies.getActiveTab.mockReturnValue('first');
    dependencies.listRoutes.mockResolvedValue({ routes: [apiRoute('first', 1)] });

    await verifyActiveSession(dependencies);

    expect(dependencies.setActiveTab).not.toHaveBeenCalled();

    dependencies.isMounted.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await verifyActiveSession(dependencies);
    expect(dependencies.updateRoutesOrder).toHaveBeenCalledTimes(1);
  });
});

describe('handleSessionFailure', () => {
  const createFailureDependencies = (error: unknown, hasCachedWorkspace = false) => ({
    error,
    token: 'token',
    isMounted: vi.fn(() => true),
    hasCachedWorkspace: vi.fn(() => hasCachedWorkspace),
    scheduleReconnect: vi.fn(),
    setVerifiedToken: vi.fn(),
    setOfflineMode: vi.fn(),
    clearSession: vi.fn(),
  });

  it('clears an invalid session even when a cached workspace exists', () => {
    const dependencies = createFailureDependencies(
      new AuthRequestError('Unauthorized', 401),
      true,
    );

    handleSessionFailure(dependencies);

    expect(dependencies.clearSession).toHaveBeenCalledOnce();
    expect(dependencies.scheduleReconnect).not.toHaveBeenCalled();
  });

  it('enters offline mode for a temporary failure with a cached workspace', () => {
    const dependencies = createFailureDependencies(new Error('Network down'), true);

    handleSessionFailure(dependencies);

    expect(dependencies.setOfflineMode).toHaveBeenCalledWith(true);
    expect(dependencies.setVerifiedToken).toHaveBeenCalledWith('token');
    expect(dependencies.scheduleReconnect).toHaveBeenCalledOnce();
  });

  it('clears an uncached session and ignores failures after unmount', () => {
    const uncached = createFailureDependencies(new Error('Network down'));
    handleSessionFailure(uncached);
    expect(uncached.clearSession).toHaveBeenCalledOnce();

    const unmounted = createFailureDependencies(new Error('Network down'), true);
    unmounted.isMounted.mockReturnValue(false);
    handleSessionFailure(unmounted);
    expect(unmounted.clearSession).not.toHaveBeenCalled();
    expect(unmounted.scheduleReconnect).not.toHaveBeenCalled();
  });
});
