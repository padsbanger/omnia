import { app } from 'electron';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type StartupOpenMode,
} from '../common/settings';
import packageJson from '../../package.json';

const STARTUP_MINIMIZED_ARG = '--startup-minimized';
const WINDOWS_LOGIN_ITEM_NAME = packageJson.build.appId;
const LEGACY_WINDOWS_LOGIN_ITEM_NAMES = [
  'electron.app.Electron',
  'electron.app.omnia',
] as const;

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

const removeWindowsRunEntry = (name: string) => {
  spawnSync(
    'reg',
    [
      'delete',
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      '/v',
      name,
      '/f',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
};

const cleanupLegacyWindowsLoginItems = () => {
  if (process.platform !== 'win32') {
    return;
  }

  LEGACY_WINDOWS_LOGIN_ITEM_NAMES.forEach(removeWindowsRunEntry);
};

export const applyStartupOpenMode = (mode: StartupOpenMode) => {
  cleanupLegacyWindowsLoginItems();

  const openAtLogin = mode !== 'no';
  const loginArgs = mode === 'minimized' ? [STARTUP_MINIMIZED_ARG] : [];

  if (process.platform === 'win32' && !app.isPackaged && openAtLogin) {
    return;
  }

  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: mode === 'minimized' && process.platform === 'darwin',
    path: process.execPath,
    args: loginArgs,
    ...(process.platform === 'win32'
      ? {
          enabled: openAtLogin,
          name: WINDOWS_LOGIN_ITEM_NAME,
        }
      : {}),
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
