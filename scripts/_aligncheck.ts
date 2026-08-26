import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { realignCaptionsToSource } from "../src/podcast/realign-to-source";

const d = process.argv[2] ?? "thongso1";
const base = `video/output/${d}`;
const full = `${base}/voice/full.mp3`;

const tokenize = (text: string): string[] =>
  text.replace(/[“”‘’]/g, '"').split(/\s+/).filter((t) => t.length > 0 && /[\p{L}\p{N}]/u.test(t));

const words = JSON.parse(readFileSync(`${base}/voice/full-words.json`, "utf-8"));
const script = JSON.parse(readFileSync(`${base}/script.json`, "utf-8"));
const fullText = script.scenes.map((s: any) => s.voiceText).join(" ");
const { words: rw } = realignCaptionsToSource(words, fullText);

// mirror detectSilences() in src/pipeline.ts
const sd = spawnSync("ffmpeg", ["-hide_banner", "-i", full, "-af", "silencedetect=n=-45dB:d=0.06", "-f", "null", "-"], { encoding: "utf-8" });
const silences: Array<{ start: number; end: number }> = [];
let pending: number | null = null;
for (const line of (sd.stderr ?? "").split("\n")) {
  const s = line.match(/silence_start:\s*(-?[\d.]+)/);
  if (s) { pending = parseFloat(s[1]); continue; }
  const e = line.match(/silence_end:\s*([\d.]+)/);
  if (e && pending !== null) { silences.push({ start: pending, end: parseFloat(e[1]) }); pending = null; }
}

// mirror pickSceneCut()
const CUT_SNAP_SEC = 0.6;
const pickSceneCut = (prevEnd: number, nextStart: number, floor: number): number => {
  const mid = (lo: number, hi: number): number | null => {
    const ov = silences
      .filter((s) => s.end > lo && s.start < hi)
      .map((s) => ({ start: Math.max(s.start, lo), end: Math.min(s.end, hi) }))
      .filter((s) => s.end > s.start && (s.start + s.end) / 2 > floor)
      .sort((a, b) => (b.end - b.start) - (a.end - a.start));
    return ov.length > 0 ? (ov[0].start + ov[0].end) / 2 : null;
  };
  const inGap = nextStart > prevEnd ? mid(prevEnd, nextStart) : null;
  if (inGap !== null) return inGap;
  const snapped = mid(prevEnd - CUT_SNAP_SEC, nextStart + CUT_SNAP_SEC);
  if (snapped !== null) return snapped;
  return Math.max(nextStart > prevEnd ? (prevEnd + nextStart) / 2 : nextStart, floor);
};

const maxDb = (start: number, dur: number): number => {
  if (dur <= 0.005) return -99;
  const r = spawnSync("ffmpeg", ["-hide_banner", "-ss", start.toFixed(3), "-t", dur.toFixed(3),
    "-i", full, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf-8" });
  const mx = (r.stderr ?? "").match(/max_volume:\s*(-?[\d.]+) dB/);
  return mx ? parseFloat(mx[1]) : NaN;
};

console.log(`${d}: ${silences.length} silence gaps\n`);
console.log("scene".padEnd(22), "lastWord".padEnd(12), "cut@".padEnd(9), "max dB +-40ms quanh diem cat");
let wordIdx = 0;
let loud = 0, n = 0, prevCut = 0;
for (let i = 0; i < script.scenes.length; i++) {
  const cnt = tokenize(script.scenes[i].voiceText).length;
  const endIdx = wordIdx + cnt - 1;
  wordIdx += cnt;
  const endW = rw[Math.min(endIdx, rw.length - 1)];
  const nextW = rw[endIdx + 1];
  if (!nextW) break;
  const cut = pickSceneCut(endW.end, nextW.start, prevCut + 0.2); prevCut = cut;
  const db = maxDb(cut - 0.04, 0.08);
  n++;
  if (db > -35) loud++;
  console.log(
    script.scenes[i].id.padEnd(22),
    (endW.w ?? "?").toString().padEnd(12),
    cut.toFixed(2).padEnd(9),
    db.toFixed(1).padStart(7),
    db > -35 ? "  <<< cat vao tieng" : "  im lang",
  );
}
console.log(`\n${loud}/${n} diem cat roi vao tieng noi.`);
