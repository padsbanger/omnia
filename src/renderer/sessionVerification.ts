import { ApiRoute } from '../common/routeMapping';
import { Route } from '../common/routes';
import { AuthRequestError, AuthUser } from './api/auth';

export const TOKEN_REFRESH_LEEWAY_MS = 60_000;

type RefreshResponse = { token: string; refreshToken: string | null };

type SessionVerificationDependencies = {
  token: string;
  refreshToken: string | null;
  now: () => number;
  isMounted: () => boolean;
  refreshSession: (refreshToken: string) => Promise<RefreshResponse>;
  getCurrentUser: (token: string) => Promise<{ user: AuthUser }>;
  listRoutes: (token: string) => Promise<{ routes: ApiRoute[] }>;
  createLocalRoute: (route: ApiRoute) => Route;
  setTokens: (token: string, refreshToken: string | null) => void;
  setSession: (token: string, user: AuthUser) => void;
  updateRoutesOrder: (routes: Route[]) => void;
  getActiveTab: () => string | null;
  setActiveTab: (routeId: string | null) => void;
  setOfflineMode: (isOffline: boolean) => void;
  setVerifiedToken: (token: string | null) => void;
  clearSession: () => void;
};

type SessionFailureDependencies = Pick<
  SessionVerificationDependencies,
  'clearSession' | 'setOfflineMode' | 'setVerifiedToken'
> & {
  error: unknown;
  token: string;
  isMounted: () => boolean;
  hasCachedWorkspace: () => boolean;
  scheduleReconnect: () => void;
};

type VerificationStartDependencies = Pick<
  SessionVerificationDependencies,
  'clearSession' | 'setOfflineMode' | 'setVerifiedToken'
> & {
  hasHydrated: boolean;
  hasToken: boolean;
  isReconnectAttempt: boolean;
  hasCompletedInitialVerification: boolean;
  resetInitialVerification: () => void;
  setIsVerifying: (isVerifying: boolean) => void;
};

type InitialVerificationCompletionDependencies = {
  isMounted: () => boolean;
  isReconnectAttempt: boolean;
  hasCompletedInitialVerification: boolean;
  completeInitialVerification: () => void;
};

export const getTokenExpirationMs = (token: string) => {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const payload = JSON.parse(window.atob(padded)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1_000 : null;
  } catch {
    return null;
  }
};

const clearCurrentSession = (
  dependencies: Pick<
    SessionVerificationDependencies,
    'clearSession' | 'setOfflineMode' | 'setVerifiedToken'
  >,
) => {
  dependencies.setVerifiedToken(null);
  dependencies.setOfflineMode(false);
  dependencies.clearSession();
};

const setLoadedRoutes = (
  routes: Route[],
  dependencies: Pick<
    SessionVerificationDependencies,
    'getActiveTab' | 'setActiveTab' | 'updateRoutesOrder'
  >,
) => {
  dependencies.updateRoutesOrder(routes);
  const activeTab = dependencies.getActiveTab();
  if (!routes.some((route) => route.id === activeTab)) {
    dependencies.setActiveTab(routes[0]?.id ?? null);
  }
};

const shouldRefreshToken = (token: string, now: number) => {
  const expiresAt = getTokenExpirationMs(token);
  return expiresAt !== null && expiresAt <= now + TOKEN_REFRESH_LEEWAY_MS;
};

export const prepareSessionVerification = (
  dependencies: VerificationStartDependencies,
) => {
  if (!dependencies.hasHydrated) return false;

  if (!dependencies.hasToken) {
    dependencies.resetInitialVerification();
    dependencies.setVerifiedToken(null);
    dependencies.setOfflineMode(false);
    dependencies.setIsVerifying(false);
    return false;
  }

  if (!dependencies.isReconnectAttempt) {
    dependencies.setVerifiedToken(null);
    dependencies.setOfflineMode(false);
    if (!dependencies.hasCompletedInitialVerification) {
      dependencies.setIsVerifying(true);
    }
  }

  return true;
};

export const completeInitialVerification = (
  dependencies: InitialVerificationCompletionDependencies,
) => {
  if (
    dependencies.isMounted() &&
    !dependencies.isReconnectAttempt &&
    !dependencies.hasCompletedInitialVerification
  ) {
    dependencies.completeInitialVerification();
  }
};

export const shouldShowAuthenticationLoader = ({
  hasCompletedInitialVerification,
  hasHydrated,
  isOffline,
  isVerifying,
  token,
  verifiedToken,
}: {
  hasCompletedInitialVerification: boolean;
  hasHydrated: boolean;
  isOffline: boolean;
  isVerifying: boolean;
  token: string | null;
  verifiedToken: string | null;
}) =>
  !hasHydrated ||
  (!hasCompletedInitialVerification &&
    (isVerifying || (Boolean(token) && !isOffline && verifiedToken !== token)));

export const verifyActiveSession = async (
  dependencies: SessionVerificationDependencies,
) => {
  if (shouldRefreshToken(dependencies.token, dependencies.now())) {
    if (!dependencies.refreshToken) {
      clearCurrentSession(dependencies);
      return;
    }

    const refreshedSession = await dependencies.refreshSession(
      dependencies.refreshToken,
    );
    if (dependencies.isMounted()) {
      dependencies.setTokens(
        refreshedSession.token,
        refreshedSession.refreshToken,
      );
    }
    return;
  }

  const { user } = await dependencies.getCurrentUser(dependencies.token);
  if (!dependencies.isMounted()) return;
  dependencies.setSession(dependencies.token, user);

  const { routes } = await dependencies.listRoutes(dependencies.token);
  if (!dependencies.isMounted()) return;

  const appRoutes = routes
    .slice()
    .sort((first, second) => first.order - second.order)
    .map(dependencies.createLocalRoute);

  setLoadedRoutes(appRoutes, dependencies);
  dependencies.setOfflineMode(false);
  dependencies.setVerifiedToken(dependencies.token);
};

export const handleSessionFailure = (
  dependencies: SessionFailureDependencies,
) => {
  if (!dependencies.isMounted()) return;

  const isInvalidSession =
    dependencies.error instanceof AuthRequestError &&
    (dependencies.error.status === 400 || dependencies.error.status === 401);

  if (isInvalidSession || !dependencies.hasCachedWorkspace()) {
    clearCurrentSession(dependencies);
    return;
  }

  dependencies.setOfflineMode(true);
  dependencies.setVerifiedToken(dependencies.token);
  dependencies.scheduleReconnect();
};
