import { app } from "electron/main";

import path from 'node:path';

type AppIconFormat = 'platform' | 'png';

const getAppIconPath = (format: AppIconFormat = 'platform') =>
  path.join(
    app.getAppPath(),
    'src',
    'assets',
    format === 'png' || process.platform !== 'win32' ? 'icon.png' : 'icon.ico',
  );

export default getAppIconPath;
