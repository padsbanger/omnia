import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  WebContentsView,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import routes, { Route } from "./routes";

let mainWindow: BrowserWindow | null = null;
const views = new Map<string, WebContentsView>(); // tabId → view

if (started) {
  app.quit();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  let activeTabId: string | null = null;

  // Single handler for activation / creation / show
  ipcMain.handle("activate-tab", async (event, { route }: { route: Route }) => {
    if (!mainWindow) return { success: false };

    let view = views.get(route.id);

    if (!view) {
      const partition = route.partition;
      const ses = session.fromPartition(partition);

      view = new WebContentsView({
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
        mainWindow?.webContents.send("tab-title-update", { route, title });
      });

      views.set(route.id, view);
      mainWindow?.webContents.send("tabId-change", { tabId: route.id });

      // Load once
      view.webContents.loadURL(route.loadURL);
    }

    // Remove ALL others to prevent overlap / stale views
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
      y: 50,
      width: winBounds.width - 93,
      height: winBounds.height - 50,
    });

    activeTabId = route.id;
    mainWindow?.webContents.send("tabId-change", { tabId: route.id });

    console.log("Activated tab", route.id);
    return { success: true };

  });

  ipcMain.handle("clear-partitions", async (event) => {
    await session.defaultSession.clearStorageData();
    routes.forEach((route) => {
      const ses = session.fromPartition(route.partition);
      ses.clearStorageData().then(() => {
        console.log(`Cleared partition ${route.partition}`);
      });
    });
  });

  // Precise bounds from React (called after activation)
  /* eslint-disable-next-line */
  ipcMain.handle("update-view-bounds", async (event, { route, bounds }) => {
    const view = views.get(route.id);
    if (!view || !mainWindow) return { success: false };

    // Re-promote to top (in case order changed)
    mainWindow.contentView.removeChildView(view);
    mainWindow.contentView.addChildView(view);

    view.setBounds(bounds);

    console.log("Bounds updated for", route.id, bounds);
    return { success: true };

    /* eslint-disable-next-line */
  });

  // Removed resize and move listeners to prevent overriding React-managed bounds
  // mainWindow.on("resize", updateActiveBounds);
  // mainWindow.on("move", updateActiveBounds);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.openDevTools();
};;

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
