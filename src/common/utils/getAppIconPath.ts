import { app } from "electron/main";

import path from 'node:path';

type AppIconFormat = 'platform' | 'png';

const getAppIconPath = (format: AppIconFormat = 'platform') => {
  if (format === 'platform' && process.platform === 'win32' && app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.ico');
  }

  return path.join(
    app.getAppPath(),
    'src',
    'assets',
    format === 'png' || process.platform !== 'win32' ? 'icon.png' : 'icon.ico',
  );
};

export default getAppIconPath;
