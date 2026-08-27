import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const app = vi.hoisted(() => ({
  getAppPath: vi.fn(() => '/app'),
  isPackaged: false,
}));

vi.mock('electron', () => ({ app }));

import getAppIconPath from './getAppIconPath';

const originalPlatform = process.platform;
const originalResourcesPath = process.resourcesPath;

const setPlatform = (platform: NodeJS.Platform) => {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
};

describe('getAppIconPath', () => {
  beforeEach(() => {
    app.isPackaged = false;
    app.getAppPath.mockReturnValue('/app');
  });

  afterEach(() => {
    setPlatform(originalPlatform);
    Object.defineProperty(process, 'resourcesPath', {
      value: originalResourcesPath,
      configurable: true,
    });
  });

  it('uses the packaged Windows icon from Electron resources', () => {
    setPlatform('win32');
    app.isPackaged = true;
    Object.defineProperty(process, 'resourcesPath', {
      value: '/resources',
      configurable: true,
    });

    expect(getAppIconPath()).toMatch(/[\\/]resources[\\/]icon\.ico$/);
  });

  it('uses an ICO file for an unpackaged Windows app', () => {
    setPlatform('win32');

    expect(getAppIconPath()).toMatch(/[\\/]app[\\/]src[\\/]assets[\\/]icon\.ico$/);
  });

  it('uses PNG icons on non-Windows platforms and when explicitly requested', () => {
    setPlatform('darwin');
    expect(getAppIconPath()).toMatch(/[\\/]app[\\/]src[\\/]assets[\\/]icon\.png$/);

    setPlatform('win32');
    expect(getAppIconPath('png')).toMatch(
      /[\\/]app[\\/]src[\\/]assets[\\/]icon\.png$/,
    );
  });
});
