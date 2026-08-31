import { app, BrowserWindow, nativeImage } from 'electron';
import { deflateSync } from 'node:zlib';
import getAppIconPath from '../../common/utils/getAppIconPath';

const getUnreadOverlayText = (count: number) => {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
};

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < CRC32_TABLE.length; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC32_TABLE[i] = value >>> 0;
}

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createPngChunk = (type: string, data = Buffer.alloc(0)) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);

  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(
    crc32(Buffer.concat([typeBuffer, data])),
    8 + data.length,
  );

  return chunk;
};

const encodePng = (width: number, height: number, pixels: Uint8Array) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const scanlineOffset = y * (1 + width * 4);
    const pixelOffset = y * width * 4;
    scanlines[scanlineOffset] = 0;
    Buffer.from(
      pixels.buffer,
      pixels.byteOffset + pixelOffset,
      width * 4,
    ).copy(scanlines, scanlineOffset + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    createPngChunk('IHDR', header),
    createPngChunk('IDAT', deflateSync(scanlines)),
    createPngChunk('IEND'),
  ]);
};

const DIGIT_GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '+': ['010', '010', '111', '010', '010'],
};

type RgbaColor = [number, number, number, number];

// Keep the taskbar overlay aligned with the route badge in Sidemenu.tsx:
// bg-rose-500 and text-white.
const UNREAD_BADGE_COLOR: RgbaColor = [255, 32, 86, 255];
const UNREAD_BADGE_TEXT_COLOR: RgbaColor = [255, 255, 255, 255];

const drawCircle = (
  pixels: Uint8Array,
  size: number,
  radius: number,
  color: RgbaColor,
) => {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      if (dx * dx + dy * dy > radius * radius) continue;

      const index = (y * size + x) * 4;
      pixels.set(color, index);
    }
  }
};

const createOverlayIcon = (count: number) => {
  const label = getUnreadOverlayText(count);
  if (!label) {
    return null;
  }

  const size = 16;
  const radius = size / 2;
  const pixels = new Uint8Array(size * size * 4);

  const setPixel = (x: number, y: number, color: RgbaColor) => {
    const index = (y * size + x) * 4;
    pixels.set(color, index);
  };

  drawCircle(pixels, size, radius, UNREAD_BADGE_COLOR);

  const scale = label.length > 2 ? 1 : 2;
  const spacing = 1;
  const glyphWidth = 3 * scale;
  const glyphHeight = 5 * scale;
  const labelWidth = label.length * glyphWidth + (label.length - 1) * spacing;
  const startX = Math.floor((size - labelWidth) / 2);
  const startY = Math.floor((size - glyphHeight) / 2);

  Array.from(label).forEach((character, characterIndex) => {
    const glyph = DIGIT_GLYPHS[character];
    if (!glyph) return;

    const characterX = startX + characterIndex * (glyphWidth + spacing);
    glyph.forEach((row, rowIndex) => {
      Array.from(row).forEach((cell, columnIndex) => {
        if (cell !== '1') return;

        for (let y = 0; y < scale; y += 1) {
          for (let x = 0; x < scale; x += 1) {
            setPixel(
              characterX + columnIndex * scale + x,
              startY + rowIndex * scale + y,
              UNREAD_BADGE_TEXT_COLOR,
            );
          }
        }
      });
    });
  });

  const overlayIcon = nativeImage.createFromBuffer(
    encodePng(size, size, pixels),
  );

  return overlayIcon.isEmpty() ? null : overlayIcon;
};

export const updateAppUnreadBadge = (
  mainWindow: BrowserWindow | null,
  totalUnread: number,
) => {
  if (process.platform === 'win32') {
    const overlayIcon = createOverlayIcon(totalUnread);
    if (totalUnread <= 0) {
      mainWindow?.setIcon(getAppIconPath());
    }
    mainWindow?.setOverlayIcon(
      overlayIcon,
      totalUnread > 0 ? `${totalUnread} unread notifications` : '',
    );
    return;
  }

  if (process.platform === 'darwin' || process.platform === 'linux') {
    app.setBadgeCount(totalUnread);
  }
};
