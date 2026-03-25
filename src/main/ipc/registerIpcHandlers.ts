import {
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  shell,
} from "electron";
import { Route } from "../../common/routes";
import isExternalUrl from "../../common/utils/isExternalUrl";

type RegisterIpcHandlersParams = {
  getMainWindow: () => BrowserWindow | null;
  views: Map<string, WebContentsView>;
  routes: Route[];
  createViewForRoute: (route: Route) => WebContentsView | null;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function registerIpcHandlers({
  getMainWindow,
  views,
  routes,
  createViewForRoute,
}: RegisterIpcHandlersParams) {
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

      const winBounds = mainWindow.getBounds();
      view.setBounds({
        x: 93,
        y: 0,
        width: winBounds.width - 93,
        height: winBounds.height,
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
}
