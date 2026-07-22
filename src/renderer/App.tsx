import { createRoot } from "react-dom/client";
import React, { useEffect, useMemo, useRef } from "react";
import { Spinner } from "@heroui/react";
import {
  HashRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { DrawerStateSnapshot, DrawerKind, WindowLayout } from "../common/drawer";
import { Route as AppRoute } from "../common/routes";
import Window from "./components/Window";
import SpreadWindows from "./components/SpreadWindows";
import DrawerWindowApp from "./components/DrawerWindowApp";
import Layout from "./components/Layout";
import AuthScreen from "./components/AuthScreen";
import {
  AuthRequestError,
  getCurrentUser,
  refreshSession,
} from "./api/auth";
import { listRoutes } from "./api/routes";
import { createLocalRouteFromApiRoute } from "../common/routeMapping";
import { useAppStore, useAuthStore } from "./store";

const isDrawerKind = (value: string | null): value is DrawerKind =>
  value === "create" || value === "manage" || value === "settings";

const BACKEND_RECONNECT_DELAY_MS = 15_000;
const TOKEN_REFRESH_LEEWAY_MS = 60_000;

const getTokenExpirationMs = (token: string) => {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(window.atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1_000 : null;
  } catch {
    return null;
  }
};

function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const previousDrawerRef = useRef<DrawerKind | null>(null);
  const {
    activeDrawer,
    activeTab,
    addRoute,
    isOffline,
    removeRoute,
    routes,
    setActiveDrawer,
    setActiveTab,
    updateRouteLabel,
    setRouteHibernation,
    setWindowLayout,
    updateUnreadCount,
    windowLayout,
  } = useAppStore();

  useEffect(() => {
    routes.forEach((route) => {
      if (!route.isHibernated) {
        window.electronAPI.invoke("create-route-view", { route });
      }
    });
  }, [routes]);

  useEffect(() => {
    const previousDrawer = previousDrawerRef.current;
    previousDrawerRef.current = activeDrawer;

    if (!activeDrawer && previousDrawer === null) {
      return;
    }

    const state: DrawerStateSnapshot = {
      activeDrawer,
      activeTab,
      routes,
      windowLayout,
      isOffline,
    };

    void window.electronAPI
      .invoke("sync-drawer-state", { state })
      .catch((error) => {
        console.error("Failed to sync drawer state", error);
      });
  }, [activeDrawer, activeTab, isOffline, routes, windowLayout]);

  useEffect(() => {
    const unsubscribeClosed = window.electronAPI.onFromMain(
      "drawer-window-closed",
      () => {
        setActiveDrawer(null);
      },
    );

    const unsubscribeCreated = window.electronAPI.onFromMain(
      "drawer-route-created",
      ({ route }: { route: AppRoute }) => {
        addRoute(route);
        setActiveTab(route.id);
        navigate(route.path);
        setActiveDrawer(null);
        void window.electronAPI.invoke("activate-tab", { route });
      },
    );

    const unsubscribeDeleted = window.electronAPI.onFromMain(
      "drawer-route-deleted",
      ({
        routeId,
        fallbackRoute,
      }: {
        routeId: string;
        fallbackRoute: AppRoute | null;
      }) => {
        removeRoute(routeId);

        if (activeTab !== routeId) {
          return;
        }

        if (fallbackRoute) {
          setActiveTab(fallbackRoute.id);
          navigate(fallbackRoute.path);
          void window.electronAPI.invoke("activate-tab", {
            route: fallbackRoute,
          });
          return;
        }

        setActiveTab(null);
        navigate("/");
      },
    );

    const unsubscribeHibernation = window.electronAPI.onFromMain(
      "drawer-route-hibernation-changed",
      ({
        routeId,
        isHibernated,
        route,
      }: {
        routeId: string;
        isHibernated: boolean;
        route: AppRoute;
      }) => {
        setRouteHibernation(routeId, isHibernated);
        if (isHibernated) {
          updateUnreadCount(routeId, 0);
          return;
        }

        if (activeTab === routeId && windowLayout === "single") {
          void window.electronAPI.invoke("activate-tab", { route });
        }
      },
    );

    const unsubscribeRouteLabel = window.electronAPI.onFromMain(
      "drawer-route-label-changed",
      ({ route }: { route: AppRoute }) => {
        if (!route?.id || !route.label) {
          return;
        }

        updateRouteLabel(route.id, route.label);
      },
    );

    const unsubscribeLayout = window.electronAPI.onFromMain(
      "drawer-window-layout-changed",
      ({ windowLayout: nextWindowLayout }: { windowLayout: WindowLayout }) => {
        setWindowLayout(nextWindowLayout);
      },
    );

    return () => {
      unsubscribeClosed?.();
      unsubscribeCreated?.();
      unsubscribeDeleted?.();
      unsubscribeHibernation?.();
      unsubscribeLayout?.();
      unsubscribeRouteLabel?.();
    };
  }, [
    activeTab,
    addRoute,
    navigate,
    removeRoute,
    setActiveDrawer,
    setActiveTab,
    setRouteHibernation,
    setWindowLayout,
    updateRouteLabel,
    updateUnreadCount,
    windowLayout,
  ]);

  useEffect(() => {
    if (windowLayout === "spread" || windowLayout === "matrix") {
      return;
    }

    const hasMatchingRoute = routes.some(
      (route) => route.path === location.pathname,
    );

    if (hasMatchingRoute) {
      return;
    }

    if (activeTab) {
      const activeRoute = routes.find((route) => route.id === activeTab);
      if (activeRoute) {
        navigate(activeRoute.path, { replace: true });
        return;
      }
    }

    const firstRoute = routes[0];
    if (firstRoute) {
      navigate(firstRoute.path, { replace: true });
    }
  }, [activeTab, location.pathname, navigate, routes, windowLayout]);

  if (windowLayout === "spread" || windowLayout === "matrix") {
    return (
      <Layout>
        <SpreadWindows />
      </Layout>
    );
  }

  return (
    <Layout>
      <Routes>
        {routes.map((route) => (
          <Route
            path={route.path}
            key={route.id}
            element={<Window route={route} />}
          />
        ))}
      </Routes>
    </Layout>
  );
}

function AuthGate() {
  const {
    clearSession,
    hasHydrated,
    refreshToken,
    setSession,
    setTokens,
    token,
    user,
  } = useAuthStore();
  const updateRoutesOrder = useAppStore((state) => state.updateRoutesOrder);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const routes = useAppStore((state) => state.routes);
  const isOffline = useAppStore((state) => state.isOffline);
  const setOfflineMode = useAppStore((state) => state.setOfflineMode);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [verifiedToken, setVerifiedToken] = React.useState<string | null>(null);
  const [verificationAttempt, setVerificationAttempt] = React.useState(0);
  const reconnectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;
    const isReconnectAttempt = isOffline && verifiedToken === token;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (!hasHydrated) {
      return () => {
        isMounted = false;
      };
    }

    if (!token) {
      setVerifiedToken(null);
      setOfflineMode(false);
      setIsVerifying(false);
      return () => {
        isMounted = false;
      };
    }

    if (!isReconnectAttempt) {
      setVerifiedToken(null);
      setOfflineMode(false);
      setIsVerifying(true);
    }

    const scheduleReconnect = () => {
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        setVerificationAttempt((attempt) => attempt + 1);
      }, BACKEND_RECONNECT_DELAY_MS);
    };

    const handleSessionFailure = (error: unknown) => {
      if (!isMounted) return;

      if (
        error instanceof AuthRequestError &&
        (error.status === 400 || error.status === 401)
      ) {
        setVerifiedToken(null);
        setOfflineMode(false);
        clearSession();
        return;
      }

      const hasCachedWorkspace =
        useAppStore.getState().routes.length > 0 &&
        Boolean(useAuthStore.getState().user);

      if (hasCachedWorkspace) {
        setOfflineMode(true);
        setVerifiedToken(token);
        scheduleReconnect();
        return;
      }

      setVerifiedToken(null);
      setOfflineMode(false);
      clearSession();
    };

    const verifySession = async () => {
      try {
        const expiresAt = getTokenExpirationMs(token);
        if (expiresAt !== null && expiresAt <= Date.now() + TOKEN_REFRESH_LEEWAY_MS) {
          if (!refreshToken) {
            setVerifiedToken(null);
            setOfflineMode(false);
            clearSession();
            return;
          }

          const refreshedSession = await refreshSession(refreshToken);
          if (!isMounted) return;
          setTokens(refreshedSession.token, refreshedSession.refreshToken);
          return;
        }

        const { user: currentUser } = await getCurrentUser(token);
        if (!isMounted) return;
        setSession(token, currentUser);

        const { routes: remoteRoutes } = await listRoutes(token);
        if (!isMounted) return;

        const appRoutes = remoteRoutes
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(createLocalRouteFromApiRoute);

        updateRoutesOrder(appRoutes);
        const activeTab = useAppStore.getState().activeTab;
        if (!appRoutes.some((route) => route.id === activeTab)) {
          setActiveTab(appRoutes[0]?.id ?? null);
        }

        setOfflineMode(false);
        setVerifiedToken(token);
      } catch (error) {
        handleSessionFailure(error);
      } finally {
        if (isMounted && !isReconnectAttempt) {
          setIsVerifying(false);
        }
      }
    };

    void verifySession();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [
    clearSession,
    hasHydrated,
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

    const refreshDelay = Math.max(
      0,
      expiresAt - Date.now() - TOKEN_REFRESH_LEEWAY_MS,
    );
    const timer = setTimeout(() => {
      setVerificationAttempt((attempt) => attempt + 1);
    }, refreshDelay);

    return () => clearTimeout(timer);
  }, [refreshToken, token]);

  useEffect(() => {
    if (!isOffline || !token) return;

    const retryWhenOnline = () => {
      setVerificationAttempt((attempt) => attempt + 1);
    };

    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [isOffline, token]);

  if (
    !hasHydrated ||
    isVerifying ||
    (token && !isOffline && verifiedToken !== token)
  ) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white">
        <Spinner
          aria-label="Loading"
          className="h-10 w-10 text-slate-700"
          size="lg"
          color="default"
        />
      </div>
    );
  }

  if (isOffline && routes.length > 0) {
    return <MainApp />;
  }

  if (!token || !user) {
    return (
      <AuthScreen
        hasCachedRoutes={routes.length > 0}
        onContinueOffline={() => setOfflineMode(true)}
      />
    );
  }

  return <MainApp />;
}

function AppRoot() {
  const drawer = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("drawer");
    return isDrawerKind(value) ? value : null;
  }, []);

  if (drawer) {
    return (
      <HashRouter>
        <DrawerWindowApp />
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <AuthGate />
    </HashRouter>
  );
}

const root = createRoot(document.body);

root.render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
