// Draws the app icon (orange basketball on green) and writes the PNGs the manifest and iOS need.
// No image library: pixels are computed directly and encoded with node:zlib. Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const GREEN = [7, 163, 90], ORANGE = [232, 116, 59], SEAM = [40, 22, 10];
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** Colour at a point in unit coordinates (-1..1, centre 0,0). */
function colourAt(x, y) {
  const r = Math.hypot(x, y), R = 0.72, w = 0.035;
  if (r > R) return GREEN;
  if (r > R - w) return SEAM; // outline
  const side = Math.abs(Math.hypot(Math.abs(x) - R * 1.42, y) - R * 1.02); // the two curved side seams
  if (Math.abs(x) < w / 2 || Math.abs(y) < w / 2 || side < w / 2) return SEAM;
  return ORANGE;
}

function png(size) {
  const SS = 4; // 4×4 supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = colourAt(((px + (sx + 0.5) / SS) / size) * 2 - 1, ((py + (sy + 0.5) / SS) / size) * 2 - 1);
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = acc[0] / SS ** 2; raw[o + 1] = acc[1] / SS ** 2; raw[o + 2] = acc[2] / SS ** 2; raw[o + 3] = 255; // opaque: iOS fills transparency with black
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const dir = new URL("../public/icons/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  writeFileSync(new URL(name, dir), png(size));
  console.log(`wrote public/icons/${name} (${size}×${size})`);
}
