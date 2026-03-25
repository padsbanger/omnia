import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  shell,
  WebContentsView,
} from "electron";
import path from "node:path";
import routes, { Route } from "../../common/routes";
import extractUnreadFromTitle from "../../common/utils/extractUnreadFromTitle";
import isExternalUrl from "../../common/utils/isExternalUrl";

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
  const unreadCounts: Array<{ routeId: string; count: number }> = [];

  // Create all views on startup
  routes.forEach((route) => {
    const partition = route.partition;
    const ses = session.fromPartition(partition);

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

    webContents.on("will-navigate", (event, url) => {
      // need to block auth redirects but allow external links to open in browser
      if (isExternalUrl(url)) {
        event.preventDefault();
        shell.openExternal(url).catch((err) => {
          console.error(`Failed to open external URL: ${url}`, err);
        });
      }
    });

    webContents.setWindowOpenHandler(({ url }) => {
      if (isExternalUrl(url)) {
        shell.openExternal(url).catch((err) => {
          console.error(`Failed to open external URL: ${url}`, err);
        });
        return { action: "deny" };
      }
      return { action: "allow" };
    });

    views.set(route.id, view);
    view.webContents.loadURL(route.loadURL);
  });

  ipcMain.handle("activate-tab", async (event, { route }: { route: Route }) => {
    if (!mainWindow) return { success: false };

    const view = views.get(route.id);
    if (!view) return { success: false };

    // Remove all other views
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

    mainWindow?.webContents.send("tabId-change", { tabId: route.id });

    console.log("Activated tab", route.id);
    return { success: true };
  });

  ipcMain.handle("update-view-bounds", async (event, { route, bounds }) => {
    const view = views.get(route.id);
    if (!view || !mainWindow) return { success: false };

    mainWindow.contentView.removeChildView(view);
    mainWindow.contentView.addChildView(view);

    view.setBounds(bounds);
    console.log("Bounds updated for", route.id, bounds);
    return { success: true };
  });

  ipcMain.handle("refresh-view", async (event, { route }: { route: Route }) => {
    const view = views.get(route.id);
    if (!view) return { success: false };
    view.webContents.reload();
    console.log("Refreshed view:", route.id);
    return { success: true };
  });

  ipcMain.handle("clear-partitions", async () => {
    await session.defaultSession.clearStorageData();
    routes.forEach((route) => {
      const ses = session.fromPartition(route.partition);
      ses.clearStorageData().then(() => {
        console.log(`Cleared partition ${route.partition}`);
      });
    });
  });

  ipcMain.handle("open-external-link", async (_, { url }) => {
    console.log("Request to open external link:", url);
    if (isExternalUrl(url)) {
      await shell.openExternal(url);
    }
  });

  // Load main renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // mainWindow.webContents.openDevTools();

  return mainWindow;
};

export default createWindow;
