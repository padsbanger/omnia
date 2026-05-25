import {
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  shell,
} from "electron";
import { DrawerStateSnapshot, WindowLayout } from "../../common/drawer";
import { Route } from "../../common/routes";
import isExternalUrl from "../../common/utils/isExternalUrl";
import {
  getCurrentUser,
  loginUser,
  registerUser,
} from "../authApi";

type RegisterIpcHandlersParams = {
  getMainWindow: () => BrowserWindow | null;
  views: Map<string, WebContentsView>;
  routes: Route[];
  createViewForRoute: (route: Route) => WebContentsView | null;
  removeRouteView: (route: Route) => Promise<boolean>;
  hibernateRouteView: (route: Route) => Promise<boolean>;
  getDrawerState: () => DrawerStateSnapshot;
  syncDrawerState: (state: DrawerStateSnapshot) => Promise<void>;
  closeDrawerWindow: () => void;
  createRouteFromDrawer: (route: Route) => Promise<boolean>;
  deleteRouteFromDrawer: (routeId: string) => Promise<{
    success: boolean;
    fallbackRoute: Route | null;
  }>;
  setRouteHibernationFromDrawer: (
    routeId: string,
    isHibernated: boolean,
  ) => Promise<boolean>;
  setWindowLayoutFromDrawer: (windowLayout: WindowLayout) => void;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AuthCredentials = {
  email: string;
  password: string;
};

export default function registerIpcHandlers({
  getMainWindow,
  views,
  routes,
  createViewForRoute,
  removeRouteView,
  hibernateRouteView,
  getDrawerState,
  syncDrawerState,
  closeDrawerWindow,
  createRouteFromDrawer,
  deleteRouteFromDrawer,
  setRouteHibernationFromDrawer,
  setWindowLayoutFromDrawer,
}: RegisterIpcHandlersParams) {
  ipcMain.removeHandler("auth-register");
  ipcMain.handle(
    "auth-register",
    async (_event, credentials: AuthCredentials) =>
      registerUser(credentials),
  );

  ipcMain.removeHandler("auth-login");
  ipcMain.handle(
    "auth-login",
    async (_event, credentials: AuthCredentials) => loginUser(credentials),
  );

  ipcMain.removeHandler("auth-me");
  ipcMain.handle("auth-me", async (_event, { token }: { token: string }) =>
    getCurrentUser(token),
  );

  ipcMain.removeHandler("activate-tab");
  ipcMain.handle(
    "activate-tab",
    async (_event, { route }: { route: Route }) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return { success: false };

      const view = views.get(route.id) ?? createViewForRoute(route);
      if (!view) return { success: false };

      for (const [id, v] of views.entries()) {
        if (id !== route.id) {
          mainWindow.contentView.removeChildView(v);
        }
      }

      mainWindow.contentView.removeChildView(view);
      mainWindow.contentView.addChildView(view);

      const contentBounds = mainWindow.getContentBounds();
      view.setBounds({
        x: 93,
        y: 0,
        width: Math.max(0, contentBounds.width - 93),
        height: contentBounds.height,
      });

      mainWindow.webContents.send("tabId-change", { tabId: route.id });
      console.log("Activated tab", route.id);

      return { success: true };
    },
  );

  ipcMain.removeHandler("update-view-bounds");
  ipcMain.handle(
    "update-view-bounds",
    async (_event, { route, bounds }: { route: Route; bounds: Bounds }) => {
      const mainWindow = getMainWindow();
      const view = views.get(route.id) ?? createViewForRoute(route);
      if (!view || !mainWindow) return { success: false };

      mainWindow.contentView.removeChildView(view);
      mainWindow.contentView.addChildView(view);

      view.setBounds(bounds);
      return { success: true };
    },
  );

  ipcMain.removeHandler("refresh-view");
  ipcMain.handle(
    "refresh-view",
    async (_event, { route }: { route: Route }) => {
      const view = views.get(route.id) ?? createViewForRoute(route);
      if (!view) return { success: false };

      view.webContents.reload();
      console.log("Refreshed view:", route.id);
      return { success: true };
    },
  );

  ipcMain.removeHandler("clear-partitions");
  ipcMain.handle("clear-partitions", async () => {
    await session.defaultSession.clearStorageData();

    routes.forEach((route) => {
      const ses = session.fromPartition(route.partition);
      ses.clearStorageData().then(() => {
        console.log(`Cleared partition ${route.partition}`);
      });
    });
  });

  ipcMain.removeHandler("clear-single-partition");
  ipcMain.handle(
    "clear-single-partition",
    async (_event, { route }: { route: Route }) => {
      const ses = session.fromPartition(route.partition);
      await ses.clearStorageData();
      console.log(`Cleared partition ${route.partition}`);
    },
  );

  ipcMain.removeHandler("open-external-link");
  ipcMain.handle("open-external-link", async (_, { url }) => {
    console.log("Request to open external link:", url);
    if (isExternalUrl(url)) {
      await shell.openExternal(url);
    }
  });

  ipcMain.removeHandler("create-route-view");
  ipcMain.handle(
    "create-route-view",
    async (_event, { route }: { route: Route }) => {
      if (!route || !route.id) {
        return { success: false, reason: "Invalid route" };
      }

      if (views.has(route.id)) {
        return { success: true };
      }

      const view = createViewForRoute(route);
      if (!view) {
        return { success: false, reason: "Failed to create route view" };
      }

      if (!routes.some((existingRoute) => existingRoute.id === route.id)) {
        routes.push(route);
      }

      return { success: true };
    },
  );

  ipcMain.removeHandler("delete-route-view");
  ipcMain.handle(
    "delete-route-view",
    async (_event, { route }: { route: Route }) => {
      if (!route || !route.id) {
        return { success: false, reason: "Invalid route" };
      }

      const deleted = await removeRouteView(route);

      if (!deleted) {
        return { success: false, reason: "Failed to delete route view" };
      }

      const routeIndex = routes.findIndex(
        (existingRoute) => existingRoute.id === route.id,
      );

      if (routeIndex >= 0) {
        routes.splice(routeIndex, 1);
      }

      return { success: true };
    },
  );

  ipcMain.removeHandler("hibernate-route-view");
  ipcMain.handle(
    "hibernate-route-view",
    async (_event, { route }: { route: Route }) => {
      if (!route || !route.id) {
        return { success: false, reason: "Invalid route" };
      }

      const hibernated = await hibernateRouteView(route);
      if (!hibernated) {
        return { success: false, reason: "Failed to hibernate route view" };
      }

      return { success: true };
    },
  );

  ipcMain.removeHandler("sync-drawer-state");
  ipcMain.handle(
    "sync-drawer-state",
    async (_event, { state }: { state: DrawerStateSnapshot }) => {
      try {
        await syncDrawerState(state);
        return { success: true };
      } catch (error) {
        console.error("Failed to sync drawer state", error);
        return { success: false };
      }
    },
  );

  ipcMain.removeHandler("get-drawer-state");
  ipcMain.handle("get-drawer-state", async () => getDrawerState());

  ipcMain.removeHandler("close-drawer-window");
  ipcMain.handle("close-drawer-window", async () => {
    closeDrawerWindow();
    return { success: true };
  });

  ipcMain.removeHandler("drawer-create-route");
  ipcMain.handle(
    "drawer-create-route",
    async (_event, { route }: { route: Route }) => {
      const success = await createRouteFromDrawer(route);
      return { success };
    },
  );

  ipcMain.removeHandler("drawer-delete-route");
  ipcMain.handle(
    "drawer-delete-route",
    async (_event, { routeId }: { routeId: string }) => {
      return deleteRouteFromDrawer(routeId);
    },
  );

  ipcMain.removeHandler("drawer-set-route-hibernation");
  ipcMain.handle(
    "drawer-set-route-hibernation",
    async (
      _event,
      {
        routeId,
        isHibernated,
      }: {
        routeId: string;
        isHibernated: boolean;
      },
    ) => {
      const success = await setRouteHibernationFromDrawer(
        routeId,
        isHibernated,
      );
      return { success };
    },
  );

  ipcMain.removeHandler("drawer-set-window-layout");
  ipcMain.handle(
    "drawer-set-window-layout",
    async (_event, { windowLayout }: { windowLayout: WindowLayout }) => {
      setWindowLayoutFromDrawer(windowLayout);
      return { success: true };
    },
  );
}
