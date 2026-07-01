import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readImageSize, readImageAspect } from "./image-dims.js";

const dir = mkdtempSync(join(tmpdir(), "imgdims-"));

/** Minimal valid PNG header (IHDR only) for the given dimensions. */
function pngHeader(w: number, h: number): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0); // signature (first 4 of 8)
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.write("IHDR", 12, "ascii");   // not strictly needed by our reader
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

/** Minimal JPEG: SOI + APP0 + SOF0 carrying dimensions. */
function jpegHeader(w: number, h: number): Buffer {
  const sof = Buffer.alloc(11);
  sof.writeUInt16BE(0xffc0, 0);   // SOF0 marker
  sof.writeUInt16BE(8 + 3, 2);    // segment length (approx, unused by reader)
  sof.writeUInt8(8, 4);           // precision
  sof.writeUInt16BE(h, 5);
  sof.writeUInt16BE(w, 7);
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]); // len 4 payload
  return Buffer.concat([soi, app0, sof]);
}

describe("readImageSize", () => {
  it("reads PNG dimensions", () => {
    const p = join(dir, "a.png");
    writeFileSync(p, pngHeader(1600, 900));
    expect(readImageSize(p)).toEqual({ w: 1600, h: 900 });
  });

  it("reads JPEG dimensions by walking to SOF0", () => {
    const p = join(dir, "a.jpg");
    writeFileSync(p, jpegHeader(408, 612));
    expect(readImageSize(p)).toEqual({ w: 408, h: 612 });
  });

  it("returns null for unreadable / unknown files", () => {
    const p = join(dir, "junk.bin");
    writeFileSync(p, Buffer.from([1, 2, 3, 4]));
    expect(readImageSize(p)).toBeNull();
    expect(readImageSize(join(dir, "nope.png"))).toBeNull();
  });
});

describe("readImageAspect", () => {
  it("landscape > 1, portrait < 1", () => {
    const land = join(dir, "l.png");
    const port = join(dir, "p.png");
    writeFileSync(land, pngHeader(1600, 900));
    writeFileSync(port, pngHeader(408, 612));
    expect(readImageAspect(land)).toBeCloseTo(1.777, 2);
    expect(readImageAspect(port)).toBeCloseTo(0.666, 2);
  });
});
