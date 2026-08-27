import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@heroui/react";
import {
  DrawerKind,
  DrawerStateSnapshot,
  WindowLayout,
} from "../../common/drawer";
import { Route as AppRoute } from "../../common/routes";
import CreateNewRouteForm from "./CreateNewRouteForm";
import ManageRoutesDrawer from "./ManageRoutesDrawer";
import SettingsDrawer from "./SettingsDrawer";
import { createRoute, deleteRoute, updateRoute } from "../api/routes";
import { createLocalRouteFromApiRoute } from "../../common/routeMapping";
import { useAuthStore } from "../store";

const isDrawerKind = (value: string | null): value is DrawerKind =>
  value === "create" || value === "manage" || value === "settings";

const DrawerWindowApp = () => {
  const drawer = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("drawer");
    return isDrawerKind(value) ? value : null;
  }, []);
  const [state, setState] = useState<DrawerStateSnapshot | null>(null);
  const token = useAuthStore((authState) => authState.token);

  useEffect(() => {
    void window.electronAPI
      .invoke<DrawerStateSnapshot>("get-drawer-state")
      .then((nextState) => {
        setState(nextState);
      });
  }, []);

  useEffect(() => {
    const unsubscribeLabelUpdated = window.electronAPI.onFromMain(
      "drawer-route-label-changed",
      ({ route }: {
        route: AppRoute;
      }) => {
        if (!route?.id) {
          return;
        }

        setState((currentState) =>
          currentState
            ? {
                ...currentState,
                routes: currentState.routes.map((item) =>
                  item.id === route.id
                    ? {
                        ...item,
                        ...route,
                      }
                    : item,
                ),
              }
            : currentState,
        );
      },
    );

    return () => {
      unsubscribeLabelUpdated?.();
    };
  }, []);

  const closeDrawer = () => {
    void window.electronAPI.invoke("close-drawer-window");
  };

  const refreshState = async () => {
    const nextState = (await window.electronAPI.invoke(
      "get-drawer-state",
    )) as DrawerStateSnapshot;
    setState(nextState);
  };

  if (!drawer) {
    return null;
  }

  if (drawer === "create") {
    return (
      <CreateNewRouteForm
        closeDrawer={closeDrawer}
        onCreateRoute={async (route) => {
          if (state?.isOffline) {
            return false;
          }

          if (!token) {
            return false;
          }

          const { route: apiRoute } = await createRoute(token, {
            name: route.label,
            url: route.loadURL,
            icon: route.icon,
            order: state?.routes.length ?? undefined,
            metadata: {
              openExternalLinksInBrowser: route.openExternalLinksInBrowser,
            },
          });

          const localRoute = createLocalRouteFromApiRoute(apiRoute);
          return window.electronAPI
            .invoke("drawer-create-route", { route: localRoute })
            .then((result) => Boolean(result?.success));
        }}
      />
    );
  }

  if (drawer === "settings") {
    return <SettingsDrawer closeDrawer={closeDrawer} />;
  }

  if (!state) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white">
        <Spinner
          aria-label="Loading routes"
          className="h-10 w-10 text-slate-700"
          size="lg"
        />
      </div>
    );
  }

  return (
    <ManageRoutesDrawer
      closeDrawer={closeDrawer}
      routes={state.routes}
      activeTab={state.activeTab}
      windowLayout={state.windowLayout}
        onDeleteRoute={async (routeId) => {
          if (state.isOffline) {
            return;
          }

          if (!token) {
            console.warn("Missing auth token: cannot delete route.");
            return;
          }

          try {
            await deleteRoute(token, routeId);
          } catch (error) {
            console.error("Failed to delete route on backend.", error);
            return;
          }

          const result = await window.electronAPI.invoke("drawer-delete-route", {
            routeId,
          });
          if (result?.success) {
            await refreshState();
            return;
          }

          console.error(
            "Failed to remove route from local app state.",
            result?.reason,
          );
        }}
      isOffline={state.isOffline}
      onToggleHibernation={async (routeId) => {
        const route = state.routes.find((item) => item.id === routeId);
        if (!route) {
          return;
        }

        await window.electronAPI.invoke("drawer-set-route-hibernation", {
          routeId,
          isHibernated: !route.isHibernated,
        });
        await refreshState();
      }}
      onWindowLayoutChange={async (windowLayout: WindowLayout) => {
        await window.electronAPI.invoke("drawer-set-window-layout", {
          windowLayout,
        });
        setState((currentState) =>
          currentState
            ? {
                ...currentState,
                windowLayout,
              }
            : currentState,
        );
      }}
      onUpdateRouteLabel={async (routeId, label) => {
        if (!state || state.isOffline) {
          return false;
        }

        const route = state.routes.find((item) => item.id === routeId);
        if (!route) {
          return false;
        }

        if (!token) {
          return false;
        }

        const nextLabel = label.trim();
        await updateRoute(token, routeId, { name: nextLabel });
        const result = await window.electronAPI.invoke(
          "drawer-update-route-label",
          { routeId, label: nextLabel },
        );
        if (result?.success) {
          setState((currentState) =>
            currentState
              ? {
                  ...currentState,
                  routes: currentState.routes.map((item) =>
                    item.id === routeId ? { ...item, label: nextLabel } : item,
                  ),
                }
              : currentState,
          );
        }
        return Boolean(result?.success);
      }}
    />
  );
};

export default DrawerWindowApp;
