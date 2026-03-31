import "dotenv/config";
import { app, BrowserWindow, components } from 'electron';
import started from "electron-squirrel-startup";
import createWindow from "./main/windows";

if (started) {
  app.quit();
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess');
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling');

app.whenReady().then(async () => {
  await components.whenReady();
  console.log('components ready:', components.status());
  createWindow();
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
