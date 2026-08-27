import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setBadgeCount, createFromBuffer } = vi.hoisted(() => ({
  setBadgeCount: vi.fn(),
  createFromBuffer: vi.fn(() => ({ isEmpty: () => false })),
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/app',
    isPackaged: false,
    setBadgeCount,
  },
  nativeImage: { createFromBuffer },
}));

import { updateAppUnreadBadge } from './appUnreadBadge';

const originalPlatform = process.platform;

const setPlatform = (platform: NodeJS.Platform) => {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
};

describe('updateAppUnreadBadge', () => {
  beforeEach(() => {
    setBadgeCount.mockClear();
    createFromBuffer.mockClear();
  });

  afterEach(() => setPlatform(originalPlatform));

  it.each(['darwin', 'linux'] as const)(
    'sets the app badge count on %s',
    (platform) => {
      setPlatform(platform);

      updateAppUnreadBadge(null, 7);

      expect(setBadgeCount).toHaveBeenCalledWith(7);
    },
  );

  it('does not update the badge on unsupported platforms', () => {
    setPlatform('freebsd');

    updateAppUnreadBadge(null, 7);

    expect(setBadgeCount).not.toHaveBeenCalled();
  });

  it('uses a Windows overlay for unread notifications', () => {
    setPlatform('win32');
    const mainWindow = {
      setIcon: vi.fn(),
      setOverlayIcon: vi.fn(),
    };

    updateAppUnreadBadge(mainWindow as never, 105);

    expect(createFromBuffer).toHaveBeenCalledOnce();
    expect(mainWindow.setIcon).not.toHaveBeenCalled();
    expect(mainWindow.setOverlayIcon).toHaveBeenCalledWith(
      expect.anything(),
      '105 unread notifications',
    );
  });

  it('clears the Windows overlay and restores the app icon at zero', () => {
    setPlatform('win32');
    const mainWindow = {
      setIcon: vi.fn(),
      setOverlayIcon: vi.fn(),
    };

    updateAppUnreadBadge(mainWindow as never, 0);

    expect(mainWindow.setIcon).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]app[\\/]src[\\/]assets[\\/]icon\.ico$/),
    );
    expect(mainWindow.setOverlayIcon).toHaveBeenCalledWith(null, '');
  });
});
