import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  app: {
    getPath: vi.fn(() => '/settings'),
    isPackaged: false,
    setLoginItemSettings: vi.fn(),
  },
  spawnSync: vi.fn(),
}));

vi.mock('electron', () => ({ app: mocks.app }));
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }));

import { applyStartupOpenMode } from './settings';

const originalPlatform = process.platform;

const setPlatform = (platform: NodeJS.Platform) => {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
};

describe('applyStartupOpenMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.app.isPackaged = false;
  });

  afterEach(() => setPlatform(originalPlatform));

  it('configures login settings on macOS, including hidden startup', () => {
    setPlatform('darwin');

    applyStartupOpenMode('minimized');

    expect(mocks.app.setLoginItemSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--startup-minimized'],
      }),
    );
  });

  it('disables automatic startup when requested', () => {
    setPlatform('linux');

    applyStartupOpenMode('no');

    expect(mocks.app.setLoginItemSettings).toHaveBeenCalledWith(
      expect.objectContaining({ openAtLogin: false, args: [] }),
    );
  });

  it('cleans legacy Windows entries and skips development login registration', () => {
    setPlatform('win32');

    applyStartupOpenMode('yes');

    expect(mocks.spawnSync).toHaveBeenCalledTimes(2);
    expect(mocks.app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('registers packaged Windows startup with the application identity', () => {
    setPlatform('win32');
    mocks.app.isPackaged = true;

    applyStartupOpenMode('yes');

    expect(mocks.app.setLoginItemSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        name: 'com.strielok.omnia',
        openAsHidden: false,
      }),
    );
  });
});
