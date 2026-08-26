import { readFileSync } from "node:fs";

/**
 * Read intrinsic pixel dimensions from an image file header without decoding
 * the whole image. Supports the formats staged into video output dirs
 * (JPEG / PNG / WebP / GIF). Returns null when the format is unrecognised or
 * the file can't be read — callers treat that as "unknown, keep default fit".
 *
 * Kept dependency-free (no sharp/image-size) so the render pipeline stays
 * light; only header bytes are parsed.
 */
export function readImageSize(path: string): { w: number; h: number } | null {
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    return null;
  }

  // ── PNG ── signature 89 50 4E 47, IHDR width/height at bytes 16/20
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }

  // ── GIF ── "GIF" then little-endian logical screen w/h at bytes 6/8
  if (buf.length >= 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }

  // ── WebP ── RIFF....WEBP + one of VP8 / VP8L / VP8X
  if (
    buf.length >= 30 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    const fmt = buf.toString("ascii", 12, 16);
    if (fmt === "VP8 ") {
      return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    }
    if (fmt === "VP8L") {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      const w = 1 + (((b1 & 0x3f) << 8) | b0);
      const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { w, h };
    }
    if (fmt === "VP8X") {
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { w, h };
    }
  }

  // ── JPEG ── walk segments to the first SOF marker (holds height/width)
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1];
      // SOF0..SOF15 carry the frame dimensions; skip DHT(C4)/JPG(C8)/DAC(CC)
      if (
        marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      ) {
        const h = buf.readUInt16BE(off + 5);
        const w = buf.readUInt16BE(off + 7);
        return { w, h };
      }
      // RST markers and standalone markers have no length payload
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        off += 2;
        continue;
      }
      const len = buf.readUInt16BE(off + 2);
      if (len < 2) break;
      off += 2 + len;
    }
  }

  return null;
}

/** width / height, or null when dimensions can't be read. */
export function readImageAspect(path: string): number | null {
  const s = readImageSize(path);
  if (!s || s.h === 0) return null;
  return s.w / s.h;
}
