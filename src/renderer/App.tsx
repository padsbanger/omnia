import { createRoot } from "react-dom/client";
import React, { useEffect, useMemo, useRef } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { DrawerStateSnapshot, DrawerKind, WindowLayout } from "../common/drawer";
import { Route as AppRoute } from "../common/routes";
import Window from "./components/Window";
import SpreadWindows from "./components/SpreadWindows";
import DrawerWindowApp from "./components/DrawerWindowApp";
import Layout from "./components/Layout";
import AuthScreen from "./components/AuthScreen";
import { getCurrentUser } from "./api/auth";
import { useAppStore, useAuthStore } from "./store";

const isDrawerKind = (value: string | null): value is DrawerKind =>
  value === "create" || value === "manage" || value === "settings";

function MainApp() {
  const navigate = useNavigate();
  const previousDrawerRef = useRef<DrawerKind | null>(null);
  const {
    activeDrawer,
    activeTab,
    addRoute,
    removeRoute,
    routes,
    setActiveDrawer,
    setActiveTab,
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
    };

    void window.electronAPI
      .invoke("sync-drawer-state", { state })
      .catch((error) => {
        console.error("Failed to sync drawer state", error);
      });
  }, [activeDrawer, activeTab, routes, windowLayout]);

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
    updateUnreadCount,
    windowLayout,
  ]);

  useEffect(() => {
    if (windowLayout === "spread" || windowLayout === "matrix") {
      return;
    }

    const hasMatchingRoute = routes.some(
      (route) => route.path === window.location.pathname,
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
  }, [activeTab, navigate, routes, windowLayout]);

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
  const { clearSession, hasHydrated, setSession, token, user } =
    useAuthStore();
  const [isVerifying, setIsVerifying] = React.useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!hasHydrated) {
      return () => {
        isMounted = false;
      };
    }

    if (!token) {
      setIsVerifying(false);
      return () => {
        isMounted = false;
      };
    }

    void getCurrentUser(token)
      .then(({ user: currentUser }) => {
        if (!isMounted) return;
        setSession(token, currentUser);
      })
      .catch(() => {
        if (!isMounted) return;
        clearSession();
      })
      .finally(() => {
        if (isMounted) {
          setIsVerifying(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [clearSession, hasHydrated, setSession, token]);

  if (!hasHydrated || isVerifying) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-600">
        Loading...
      </div>
    );
  }

  if (!token || !user) {
    return <AuthScreen />;
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
      <BrowserRouter>
        <DrawerWindowApp />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  );
}

const root = createRoot(document.body);

root.render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
