import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type StartupOpenMode,
} from '../common/settings';

const STARTUP_MINIMIZED_ARG = '--startup-minimized';

const getSettingsPath = () =>
  path.join(app.getPath('userData'), 'settings.json');

const readSettingsFile = (): AppSettings => {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

const writeSettingsFile = (settings: AppSettings) => {
  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
};

export const getAppSettings = () => readSettingsFile();

export const applyStartupOpenMode = (mode: StartupOpenMode) => {
  const openAtLogin = mode !== 'no';
  const loginArgs = mode === 'minimized' ? [STARTUP_MINIMIZED_ARG] : [];

  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: mode === 'minimized' && process.platform === 'darwin',
    path: process.execPath,
    args: loginArgs,
  });
};

export const updateStartupOpenMode = (mode: StartupOpenMode) => {
  const nextSettings: AppSettings = {
    ...getAppSettings(),
    startupOpenMode: mode,
  };

  writeSettingsFile(nextSettings);
  applyStartupOpenMode(mode);

  return nextSettings;
};

export const initializeAppSettings = () => {
  const settings = getAppSettings();
  applyStartupOpenMode(settings.startupOpenMode);
  return settings;
};

export const shouldLaunchMinimized = (argv: string[] = process.argv) =>
  argv.includes(STARTUP_MINIMIZED_ARG);
