import { app } from "electron/main";

import path from 'node:path';

const getAppIconPath = () =>
  path.join(app.getAppPath(), 'src', 'assets', 'icon.png');

export default getAppIconPath;