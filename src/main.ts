import "dotenv/config";
import { app, BrowserWindow, components, ipcMain, Menu, shell } from 'electron';
import started from "electron-squirrel-startup";
import createWindow from "./main/windows";
import {
  getAppSettings,
  initializeAppSettings,
  shouldLaunchMinimized,
  updateStartupOpenMode,
} from "./main/settings";
import { type StartupOpenMode } from "./common/settings";

const createApplicationMenu = () => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            mainWindow?.webContents.send('open-settings');
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Github',
          click: () => {
            void shell.openExternal('https://github.com/padsbanger/omnia');
          },
        },
                {
          label: 'Website',
          click: () => {
            void shell.openExternal('https://omnia.pripyat.cloud/');
          },
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
};

if (started) {
  app.quit();
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess');
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling');

app.whenReady().then(async () => {
  await components.whenReady();
  console.log('components ready:', components.status());
  initializeAppSettings();
  createApplicationMenu();

  ipcMain.removeHandler('get-app-settings');
  ipcMain.handle('get-app-settings', () => getAppSettings());

  ipcMain.removeHandler('set-startup-open-mode');
  ipcMain.handle(
    'set-startup-open-mode',
    (_event, { mode }: { mode: StartupOpenMode }) =>
      updateStartupOpenMode(mode),
  );

  createWindow({ startMinimized: shouldLaunchMinimized() });
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
