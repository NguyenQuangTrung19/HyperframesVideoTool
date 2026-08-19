import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getDurationSec, concatWithSilence, mixBgMusicOntoVoice, resolveBgMusic } from "./audio-tools.js";

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "aud-")); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

describe("getDurationSec", () => {
  it("returns ~2s for sample-audio-1.mp3", async () => {
    const d = await getDurationSec("tests/fixtures/sample-audio-1.mp3");
    expect(d).toBeGreaterThan(1.9);
    expect(d).toBeLessThan(2.2);
  });
});

describe("concatWithSilence", () => {
  it("concatenates two mp3s with 0.3s gap", async () => {
    const out = join(tmp, "voice.mp3");
    await concatWithSilence(
      ["tests/fixtures/sample-audio-1.mp3", "tests/fixtures/sample-audio-2.mp3"],
      0.3,
      out,
    );
    expect(existsSync(out)).toBe(true);
    const d = await getDurationSec(out);
    // 2s + 0.3s + 3s = 5.3s, allow ±0.3s
    expect(d).toBeGreaterThan(5.0);
    expect(d).toBeLessThan(5.6);
  });
});

describe("resolveBgMusic", () => {
  const lib = ["calm.mp3", "epic.wav", "notes.txt", "cover.jpg", "drive.m4a"];
  const ls = () => lib;

  it("returns null when the env var is set but empty (explicit off)", () => {
    expect(resolveBgMusic("/lib", "", ls)).toBeNull();
    expect(resolveBgMusic("/lib", "   ", ls)).toBeNull();
  });

  it("resolves a bare filename inside the music dir", () => {
    expect(resolveBgMusic("/lib", "calm.mp3", ls)).toBe(join("/lib", "calm.mp3"));
  });

  it("uses an explicit path as-is instead of joining the music dir", () => {
    const got = resolveBgMusic("/lib", "D:/beds/track.mp3", ls)!;
    expect(got).not.toContain("lib");
    expect(got.toLowerCase()).toContain("track.mp3");
  });

  it("returns null when unset and the library is empty", () => {
    expect(resolveBgMusic("/lib", undefined, () => [])).toBeNull();
  });

  it("returns null when unset and the library holds no audio files", () => {
    expect(resolveBgMusic("/lib", undefined, () => ["readme.md", "art.png"])).toBeNull();
  });

  it("auto-picks only audio files, never README/artwork", () => {
    const picked = new Set<string>();
    for (let i = 0; i < 60; i++) picked.add(resolveBgMusic("/lib", undefined, ls)!);
    expect([...picked].sort()).toEqual(
      ["calm.mp3", "drive.m4a", "epic.wav"].map((f) => join("/lib", f)).sort(),
    );
  });
});

describe("mixBgMusicOntoVoice", () => {
  it("loops a short bed under a longer voice and pins output to voice length", async () => {
    const out = join(tmp, "mixed.mp3");
    // sample-audio-1 is ~2s; sample-audio-2 (~3s) is the voice, so the bed loops.
    await mixBgMusicOntoVoice(
      "tests/fixtures/sample-audio-2.mp3",
      "tests/fixtures/sample-audio-1.mp3",
      out,
      { volume: 0.1 },
    );
    expect(existsSync(out)).toBe(true);
    const voiceDur = await getDurationSec("tests/fixtures/sample-audio-2.mp3");
    const outDur = await getDurationSec(out);
    expect(Math.abs(outDur - voiceDur)).toBeLessThan(0.4);
  });
});
