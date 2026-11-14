// 앱 아이콘(PNG) 생성 스크립트: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const BG = [28, 26, 24];
const BALL = [242, 107, 29];
const SEAM = [28, 26, 24];

function draw(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2, cy = size / 2, R = size * 0.34, w = size * 0.022;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      const d = Math.hypot(px - cx, py - cy);
      let col = BG;
      if (d <= R) {
        col = BALL;
        const seamV = Math.abs(px - cx) < w;
        const seamH = Math.abs(py - cy) < w;
        const cL = Math.abs(Math.hypot(px - (cx - R * 1.25), py - cy) - R * 0.95) < w;
        const cR = Math.abs(Math.hypot(px - (cx + R * 1.25), py - cy) - R * 0.95) < w;
        if (seamV || seamH || cL || cR || d > R - w * 1.2) col = SEAM;
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
for (const s of [180, 192, 512]) {
  writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), draw(s));
}
console.log('icons written');
