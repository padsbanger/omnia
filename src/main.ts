import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  WebContentsView,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

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
  ipcMain.handle(
    "activate-gmail-tab",
    async (event, { tabId }: { tabId: string }) => {
      if (!mainWindow) return { success: false };

      let view = views.get(tabId);

      if (!view) {
        const partition = `persist:gmail-${tabId}`;
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
          mainWindow?.webContents.send("tab-title-update", { tabId, title });
        });

        views.set(tabId, view);

        // Load once
        view.webContents.loadURL("https://mail.google.com");
      }

      // Remove ALL others to prevent overlap / stale views
      for (const [id, v] of views.entries()) {
        if (id !== tabId) {
          mainWindow.contentView.removeChildView(v);
        }
      }

      // Bring target to top (remove + add forces z-order to top)
      mainWindow.contentView.removeChildView(view);
      mainWindow.contentView.addChildView(view);

      // Initial bounds from window (will be overridden by React soon)
      const winBounds = mainWindow.getBounds();
      view.setBounds({
        x: 0,
        y: 50,
        width: winBounds.width,
        height: winBounds.height - 50,
      });

      activeTabId = tabId;

      return { success: true };
    },
  );

  // Precise bounds from React (called after activation)
  ipcMain.handle(
    "update-gmail-view-bounds",
    async (event, { tabId, bounds }) => {
      const view = views.get(tabId);
      if (!view || !mainWindow) return { success: false };

      // Re-promote to top (in case order changed)
      mainWindow.contentView.removeChildView(view);
      mainWindow.contentView.addChildView(view);

      view.setBounds(bounds);

      return { success: true };
    },
  );

  // One-time resize handler for fallback
  const updateActiveBounds = () => {
    if (!mainWindow || !activeTabId) return;
    const view = views.get(activeTabId);
    if (view) {
      const winBounds = mainWindow.getBounds();
      view.setBounds({
        x: 0,
        y: 50,
        width: winBounds.width,
        height: winBounds.height - 50,
      });
    }
  };

  mainWindow.on("resize", updateActiveBounds);
  mainWindow.on("move", updateActiveBounds);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Optional: if you want precise positioning from React <div> ref

  mainWindow.webContents.openDevTools();
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
