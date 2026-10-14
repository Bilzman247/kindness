import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal compliant PNG builder using pure Node.js zlib
function createPngBuffer(width, height, getPixelRGBA) {
  // 1. Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // 2. IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace 0

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // 3. IDAT Chunk (raw uncompressed scanlines with filter byte 0)
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRGBA(x, y, width, height);
      scanlines[offset++] = r;
      scanlines[offset++] = g;
      scanlines[offset++] = b;
      scanlines[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = makeChunk('IDAT', compressed);

  // 4. IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 implementation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Pixel generators
function drawIcon(x, y, width, height, isMaskable = false) {
  const nx = x / width;
  const ny = y / height;

  // Maskable has 15% safe padding
  const cx = 0.5;
  const cy = 0.46;
  const dx = nx - cx;
  const dy = ny - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background deep navy gradient
  const bgR = Math.round(15 + nx * 10);
  const bgG = Math.round(23 + ny * 20);
  const bgB = Math.round(42 + (nx + ny) * 35);

  if (!isMaskable) {
    // Rounded corners for regular icon
    const cornerR = 0.22;
    const inCornerX = Math.min(nx, 1 - nx) < cornerR;
    const inCornerY = Math.min(ny, 1 - ny) < cornerR;
    if (inCornerX && inCornerY) {
      const cdx = cornerR - Math.min(nx, 1 - nx);
      const cdy = cornerR - Math.min(ny, 1 - ny);
      if (cdx * cdx + cdy * cdy > cornerR * cornerR) {
        return [0, 0, 0, 0]; // Transparent outside squircle
      }
    }
  }

  // Ring for "G"
  const ringRadius = isMaskable ? 0.22 : 0.26;
  const ringThickness = isMaskable ? 0.055 : 0.065;

  if (Math.abs(dist - ringRadius) < ringThickness) {
    const angle = Math.atan2(dy, dx); // -pi to +pi
    // Opening at bottom-right of G
    if (!(angle > -0.2 && angle < 0.6)) {
      // Vibrant blue/emerald gradient for the G ring
      const factor = (angle + Math.PI) / (2 * Math.PI);
      const r = Math.round(16 + factor * 40);
      const g = Math.round(185 - factor * 40);
      const b = Math.round(129 + factor * 120);
      return [r, g, b, 255];
    }
  }

  // Crossbar of the G
  if (dx >= 0 && dx <= ringRadius * 0.9 && Math.abs(dy) <= ringThickness * 0.75) {
    return [56, 189, 248, 255]; // Cyan crossbar
  }

  // Upright of the G
  if (Math.abs(dx - ringRadius * 0.9) <= ringThickness * 0.75 && dy >= 0 && dy <= ringRadius) {
    return [56, 189, 248, 255];
  }

  // Trend line wave at bottom
  const waveY = 0.76 + Math.sin(nx * 12) * 0.035;
  if (Math.abs(ny - waveY) < 0.015) {
    return [16, 185, 129, 220]; // Emerald trendline
  }

  return [bgR, bgG, bgB, 255];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

console.log('Generating compliant PWA PNG assets...');

// 1. 192x192
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPngBuffer(192, 192, (x, y, w, h) => drawIcon(x, y, w, h, false)));
console.log('✓ Created pwa-192x192.png');

// 2. 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPngBuffer(512, 512, (x, y, w, h) => drawIcon(x, y, w, h, false)));
console.log('✓ Created pwa-512x512.png');

// 3. 512x512 Maskable
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPngBuffer(512, 512, (x, y, w, h) => drawIcon(x, y, w, h, true)));
console.log('✓ Created pwa-maskable-512x512.png');

// 4. Apple Touch Icon 180x180
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPngBuffer(180, 180, (x, y, w, h) => drawIcon(x, y, w, h, false)));
console.log('✓ Created apple-touch-icon.png');

// 5. Favicon 48x48
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPngBuffer(48, 48, (x, y, w, h) => drawIcon(x, y, w, h, false)));
console.log('✓ Created favicon.ico');

console.log('All PWA icon assets generated successfully!');
