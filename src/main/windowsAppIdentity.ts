import fs from 'node:fs';
import path from 'node:path';
import packageJson from '../../package.json';

const getSquirrelAppUserModelId = () => {
  const packageId = packageJson.name.replace(/-/g, '_');
  const executableName = packageJson.productName;
  return `com.squirrel.${packageId}.${executableName}`;
};

const isSquirrelInstallation = (executablePath: string) =>
  fs.existsSync(path.resolve(path.dirname(executablePath), '..', 'Update.exe'));

// Squirrel writes its own AppUserModelID into installed shortcuts. Windows
// silently drops or misattributes toasts when the running process forces a
// different ID. Keep the custom ID for unpacked/dev builds whose shortcut uses
// it, and use Squirrel's deterministic ID for an installed release.
export const getWindowsAppUserModelId = (
  executablePath: string = process.execPath,
) =>
  isSquirrelInstallation(executablePath)
    ? getSquirrelAppUserModelId()
    : packageJson.build.appId;

export default getWindowsAppUserModelId;
