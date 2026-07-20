import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data) => {
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
};
for (const size of [192, 512]) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      const border = Math.min(x, y, size - 1 - x, size - 1 - y);
      const panel = border > size * 0.18 && border < size * 0.22;
      const slashA = Math.abs(x - size * 0.32 - Math.abs(y - size * 0.5) * 0.68) < size * 0.035;
      const slashB = Math.abs(size * 0.68 - x - Math.abs(y - size * 0.5) * 0.68) < size * 0.035;
      const green = panel || ((slashA || slashB) && y > size * 0.31 && y < size * 0.69);
      rows[offset] = green ? 100 : 17;
      rows[offset + 1] = green ? 215 : 17;
      rows[offset + 2] = green ? 130 : 20;
      rows[offset + 3] = 255;
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    new URL(`../public/icons/icon-${size}.png`, import.meta.url),
    Buffer.concat([
      Buffer.from("89504e470d0a1a0a", "hex"),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(rows)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
