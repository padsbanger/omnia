import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inflateSync } from 'node:zlib';

const { setBadgeCount, createFromBuffer } = vi.hoisted(() => ({
  setBadgeCount: vi.fn(),
  createFromBuffer: vi.fn((_buffer: Buffer) => ({ isEmpty: () => false })),
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

const readPngPixel = (png: Buffer, x: number, y: number) => {
  const width = png.readUInt32BE(16);
  const idatChunks: Buffer[] = [];
  let offset = 8;

  while (offset < png.length) {
    const chunkLength = png.readUInt32BE(offset);
    const chunkType = png.toString('ascii', offset + 4, offset + 8);
    if (chunkType === 'IDAT') {
      idatChunks.push(png.subarray(offset + 8, offset + 8 + chunkLength));
    }
    offset += 12 + chunkLength;
  }

  const scanlines = inflateSync(Buffer.concat(idatChunks));
  const pixelOffset = y * (1 + width * 4) + 1 + x * 4;
  return Array.from(scanlines.subarray(pixelOffset, pixelOffset + 4));
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

  it('renders a full-width circular rose badge on Windows', () => {
    setPlatform('win32');
    const mainWindow = {
      setIcon: vi.fn(),
      setOverlayIcon: vi.fn(),
    };

    updateAppUnreadBadge(mainWindow as never, 1);

    const png = createFromBuffer.mock.calls[0][0] as Buffer;
    expect(readPngPixel(png, 0, 8)).toEqual([255, 32, 86, 255]);
    expect(readPngPixel(png, 0, 0)).toEqual([0, 0, 0, 0]);
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
