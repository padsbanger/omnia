import { useEffect, useMemo, useState } from "react";
import {
  DrawerKind,
  DrawerStateSnapshot,
  WindowLayout,
} from "../../common/drawer";
import CreateNewRouteForm from "./CreateNewRouteForm";
import ManageRoutesDrawer from "./ManageRoutesDrawer";
import SettingsDrawer from "./SettingsDrawer";

const isDrawerKind = (value: string | null): value is DrawerKind =>
  value === "create" || value === "manage" || value === "settings";

const DrawerWindowApp = () => {
  const drawer = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("drawer");
    return isDrawerKind(value) ? value : null;
  }, []);
  const [state, setState] = useState<DrawerStateSnapshot | null>(null);

  useEffect(() => {
    void window.electronAPI
      .invoke("get-drawer-state")
      .then((nextState: DrawerStateSnapshot) => {
        setState(nextState);
      });
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
        onCreateRoute={(route) =>
          window.electronAPI
            .invoke("drawer-create-route", { route })
            .then((result) => Boolean(result?.success))
        }
      />
    );
  }

  if (drawer === "settings") {
    return <SettingsDrawer closeDrawer={closeDrawer} />;
  }

  if (!state) {
    return <div className="p-5 text-sm text-gray-500">Loading routes...</div>;
  }

  return (
    <ManageRoutesDrawer
      closeDrawer={closeDrawer}
      routes={state.routes}
      activeTab={state.activeTab}
      windowLayout={state.windowLayout}
      onDeleteRoute={async (routeId) => {
        await window.electronAPI.invoke("drawer-delete-route", { routeId });
        await refreshState();
      }}
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
    />
  );
};

export default DrawerWindowApp;
