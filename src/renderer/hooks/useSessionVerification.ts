import { useEffect, useRef, useState } from 'react';
import { ApiRoute } from '../../common/routeMapping';
import { Route } from '../../common/routes';
import { AuthUser } from '../api/auth';
import {
  completeInitialVerification as completeInitialVerificationIfNeeded,
  getTokenExpirationMs,
  handleSessionFailure,
  prepareSessionVerification,
  TOKEN_REFRESH_LEEWAY_MS,
  verifyActiveSession,
} from '../sessionVerification';

const BACKEND_RECONNECT_DELAY_MS = 15_000;

type SessionVerificationOptions = {
  hasHydrated: boolean;
  token: string | null;
  refreshToken: string | null;
  isOffline: boolean;
  clearSession: () => void;
  setTokens: (token: string, refreshToken: string | null) => void;
  setSession: (token: string, user: AuthUser) => void;
  updateRoutesOrder: (routes: Route[]) => void;
  getActiveTab: () => string | null;
  setActiveTab: (routeId: string | null) => void;
  setOfflineMode: (isOffline: boolean) => void;
  hasCachedWorkspace: () => boolean;
  refreshSession: (refreshToken: string) => Promise<{
    token: string;
    refreshToken: string | null;
  }>;
  getCurrentUser: (token: string) => Promise<{ user: AuthUser }>;
  listRoutes: (token: string) => Promise<{ routes: ApiRoute[] }>;
  createLocalRoute: (route: ApiRoute) => Route;
};

export const useSessionVerification = (options: SessionVerificationOptions) => {
  const {
    clearSession,
    createLocalRoute,
    getActiveTab,
    getCurrentUser,
    hasCachedWorkspace,
    hasHydrated,
    isOffline,
    listRoutes,
    refreshSession,
    refreshToken,
    setActiveTab,
    setOfflineMode,
    setSession,
    setTokens,
    token,
    updateRoutesOrder,
  } = options;
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [hasCompletedInitialVerification, setHasCompletedInitialVerification] =
    useState(false);
  const initialVerificationRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishInitialVerification = () => {
    initialVerificationRef.current = true;
    setHasCompletedInitialVerification(true);
    setIsVerifying(false);
  };

  const resetInitialVerification = () => {
    initialVerificationRef.current = false;
    setHasCompletedInitialVerification(false);
  };

  useEffect(() => {
    let isMounted = true;
    const isReconnectAttempt = isOffline && verifiedToken === token;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const scheduleReconnect = () => {
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        setVerificationAttempt((attempt) => attempt + 1);
      }, BACKEND_RECONNECT_DELAY_MS);
    };

    const shouldVerify = prepareSessionVerification({
      hasHydrated,
      hasToken: Boolean(token),
      isReconnectAttempt,
      hasCompletedInitialVerification: initialVerificationRef.current,
      resetInitialVerification,
      setIsVerifying,
      setVerifiedToken,
      setOfflineMode,
      clearSession,
    });

    if (shouldVerify && token) {
      const runVerification = async () => {
        try {
          await verifyActiveSession({
            token,
            refreshToken,
            now: Date.now,
            isMounted: () => isMounted,
            refreshSession,
            getCurrentUser,
            listRoutes,
            createLocalRoute,
            setTokens,
            setSession,
            updateRoutesOrder,
            getActiveTab,
            setActiveTab,
            setOfflineMode,
            setVerifiedToken,
            clearSession,
          });
        } catch (error) {
          handleSessionFailure({
            error,
            token,
            isMounted: () => isMounted,
            hasCachedWorkspace,
            scheduleReconnect,
            setVerifiedToken,
            setOfflineMode,
            clearSession,
          });
        } finally {
          completeInitialVerificationIfNeeded({
            isMounted: () => isMounted,
            isReconnectAttempt,
            hasCompletedInitialVerification: initialVerificationRef.current,
            completeInitialVerification: finishInitialVerification,
          });
        }
      };

      void runVerification();
    }

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  // Setting either value is the result of a verification. They must not start
  // another request; retries advance verificationAttempt instead.
  }, [
    clearSession,
    createLocalRoute,
    getActiveTab,
    getCurrentUser,
    hasCachedWorkspace,
    hasHydrated,
    listRoutes,
    refreshSession,
    refreshToken,
    setActiveTab,
    setOfflineMode,
    setSession,
    setTokens,
    token,
    updateRoutesOrder,
    verificationAttempt,
  ]);

  useEffect(() => {
    if (!token || !refreshToken) return;

    const expiresAt = getTokenExpirationMs(token);
    if (expiresAt === null) return;

    const timer = setTimeout(() => {
      setVerificationAttempt((attempt) => attempt + 1);
    }, Math.max(0, expiresAt - Date.now() - TOKEN_REFRESH_LEEWAY_MS));

    return () => clearTimeout(timer);
  }, [refreshToken, token]);

  useEffect(() => {
    if (!isOffline || !token) return;

    const retryWhenOnline = () => {
      setVerificationAttempt((attempt) => attempt + 1);
    };

    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [isOffline, token]);

  return {
    hasCompletedInitialVerification,
    isVerifying,
    verifiedToken,
  };
};
