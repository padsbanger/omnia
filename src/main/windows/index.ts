import { BrowserWindow, session, shell, WebContentsView } from "electron";
import path from "node:path";
import { Route } from "../../common/routes";
import extractUnreadFromTitle from "../../common/utils/extractUnreadFromTitle";
import {
  getExternalUrlTarget,
  default as isExternalUrl,
} from "../../common/utils/isExternalUrl";
import { registerIpcHandlers } from "../ipc";

const createWindow = () => {
  let mainWindow: BrowserWindow | null = null;

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const views = new Map<string, WebContentsView>(); // tabId → view
  const runtimeRoutes: Route[] = [];
  const unreadCounts: Array<{ routeId: string; count: number }> = [];

  const createViewForRoute = (route: Route) => {
    if (!runtimeRoutes.some((existingRoute) => existingRoute.id === route.id)) {
      runtimeRoutes.push(route);
    }

    if (views.has(route.id)) {
      return views.get(route.id) ?? null;
    }

    const partition = route.partition;
    const ses = session.fromPartition(partition);
    const internalHosts = route.internalHosts ?? [
      new URL(route.loadURL).hostname,
    ];
    const openExternalLinksInBrowser = route.openExternalLinksInBrowser ?? true;

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    view.webContents.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    );

    view.webContents.on("page-title-updated", (e, title) => {
      console.log("Page title updated for", route.id, ":", title);
      const unread = extractUnreadFromTitle(title);
      console.log("Extracted unread count:", unread);

      const existing = unreadCounts.find((u) => u.routeId === route.id);
      if (existing) {
        existing.count = unread;
      } else {
        unreadCounts.push({ routeId: route.id, count: unread });
      }

      const totalUnread = unreadCounts.reduce((a, b) => a + b.count, 0);

      mainWindow?.webContents.send("global-unread-update", {
        unreadCounts,
        total: totalUnread,
      });
      mainWindow?.webContents.send("unread-update", {
        routeId: route.id,
        count: unread,
      });
    });

    const webContents = view.webContents;

    const openInExternalBrowser = (url: string) => {
      const externalTarget = getExternalUrlTarget(url, internalHosts) ?? url;

      return shell.openExternal(externalTarget).catch((err) => {
        console.error(`Failed to open external URL: ${externalTarget}`, err);
      });
    };

    const shouldOpenExternally = (url: string) => {
      return isExternalUrl(url, internalHosts);
    };

    webContents.on("will-navigate", (event, url) => {
      if (shouldOpenExternally(url)) {
        event.preventDefault();
        void openInExternalBrowser(url);
      }
    });

    webContents.setWindowOpenHandler(({ url }) => {
      if (shouldOpenExternally(url)) {
        void openInExternalBrowser(url);
        return { action: "deny" };
      }

      // Internal URL (e.g. OAuth popup) — load in-place to avoid a floating
      // BrowserWindow popup. The OAuth redirect will bring the user back.
      webContents.loadURL(url).catch((err) => {
        console.error(`Failed to load popup URL in-app: ${url}`, err);
      });
      return { action: "deny" };

    });

    views.set(route.id, view);
    void view.webContents.loadURL(route.loadURL);

    return view;
  };

  const removeRouteView = async (route: Route) => {
    const view = views.get(route.id);

    if (view) {
      mainWindow?.contentView.removeChildView(view);
      views.delete(route.id);

      if (!view.webContents.isDestroyed()) {
        view.webContents.close({ waitForBeforeUnload: false });
      }
    }

    const unreadIndex = unreadCounts.findIndex(
      (item) => item.routeId === route.id,
    );
    if (unreadIndex >= 0) {
      unreadCounts.splice(unreadIndex, 1);
    }

    const routeIndex = runtimeRoutes.findIndex(
      (existingRoute) => existingRoute.id === route.id,
    );
    if (routeIndex >= 0) {
      runtimeRoutes.splice(routeIndex, 1);
    }

    try {
      await session.fromPartition(route.partition).clearStorageData();
    } catch (error) {
      console.error(`Failed to clear partition ${route.partition}`, error);
    }

    const totalUnread = unreadCounts.reduce(
      (total, item) => total + item.count,
      0,
    );
    mainWindow?.webContents.send("global-unread-update", {
      unreadCounts,
      total: totalUnread,
    });

    return true;
  };

  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    views,
    routes: runtimeRoutes,
    createViewForRoute,
    removeRouteView,
  });

  // Load main renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.openDevTools();

  return mainWindow;
};

export default createWindow;
