import { BrowserWindow, nativeImage } from "electron";

import getAppIconPath from "../../common/utils/getAppIconPath";

const createSplashWindow = () => {
  const splashWindow = new BrowserWindow({
    width: 320,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const iconDataUrl = nativeImage
    .createFromPath(getAppIconPath('png'))
    .toDataURL();
  const splashHtml = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta
        http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"
      />
      <style>
        :root {
          color-scheme: light;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          background: transparent;
        }

        img {
          width: 100vw;
          height: 100vh;
          display: block;
          object-fit: cover;
        }
      </style>
    </head>
    <body>
      <img src="${iconDataUrl}" alt="Omnia" />
    </body>
  </html>`;

  void splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`,
  );

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });

  return splashWindow;
};

export default createSplashWindow;
