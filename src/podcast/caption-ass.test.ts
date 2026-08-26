import { describe, expect, it } from "vitest";
import { buildAssFromWords } from "./caption-ass.js";

const sampleWords = [
  { w: "Vinícius", start: 0.50, end: 0.92 },
  { w: "hỏng", start: 0.95, end: 1.20 },
  { w: "bốn", start: 1.22, end: 1.40 },
  { w: "quả", start: 1.42, end: 1.65 },
  { w: "penalty", start: 1.68, end: 2.20 },
];

describe("buildAssFromWords", () => {
  it("emits a valid header with 1080x1920 canvas", () => {
    const ass = buildAssFromWords(sampleWords);
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("PlayResY: 1920");
    expect(ass).toContain("[V4+ Styles]");
    expect(ass).toContain("[Events]");
  });

  it("emits one Dialogue event per word", () => {
    const ass = buildAssFromWords(sampleWords);
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(events).toHaveLength(sampleWords.length);
  });

  it("tiles events so each ends at the next word's start", () => {
    const ass = buildAssFromWords(sampleWords);
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    // Event 0 covers 0.50 → 0.95 (= next word start)
    expect(events[0]).toContain("0:00:00.50,0:00:00.95");
    // Event 1 covers 0.95 → 1.22
    expect(events[1]).toContain("0:00:00.95,0:00:01.22");
  });

  it("highlights the active word with the requested active color", () => {
    const ass = buildAssFromWords(sampleWords, { activeColorRgb: "FFFF00", popScale: 100 });
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    // ASS yellow is &H0000FFFF& (BGR-encoded RGB FFFF00)
    expect(events[0]).toContain("\\c&H0000FFFF&");
    // With pop disabled (popScale=100), active word wraps cleanly:
    // {\c<active>}word{\fscx100\fscy100\c<base>}
    expect(events[0]).toContain("\\c&H0000FFFF&}Vinícius{");
    expect(events[0]).toMatch(/\\c&H0000FFFF&}Vinícius\{[^}]*\\c&H[0-9A-F]+&}/);
  });

  it("emits the active-word color override with no scale animation by default", () => {
    const ass = buildAssFromWords(sampleWords);
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    // Default popScale=100 disables the scale-pop tween (it caused the centered
    // text to shift left/right as the active word scaled — color change alone
    // is enough). The active word is still color-flipped via \c.
    expect(events[0]).toContain("\\c&H00FFFFFF&}Vinícius");
    expect(events[0]).not.toContain("\\t(");
  });

  it("clamps overlapping events from non-monotonic word timings", () => {
    // Simulates the realigner edge case: inserted source words whose
    // interpolated end time runs past the next paired Whisper anchor,
    // producing a temporally-backwards transition. Each event's end
    // must be clamped to the next event's start so two captions never
    // render simultaneously.
    const nonMono = [
      { w: "A", start: 0.0, end: 0.2 },
      { w: "B", start: 0.2, end: 0.4 },
      { w: "C", start: 0.1, end: 0.3 }, // starts BEFORE B ends
    ];
    const ass = buildAssFromWords(nonMono);
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    const t2s = (t: string) => {
      const [h, m, s] = t.split(":");
      return +h * 3600 + +m * 60 + parseFloat(s);
    };
    const ranges = events.map((l) => {
      const p = l.split(",", 10);
      return [t2s(p[1]), t2s(p[2])] as [number, number];
    });
    // After sort+clamp: ranges must be monotonically tiled.
    for (let i = 0; i < ranges.length - 1; i++) {
      expect(ranges[i][1]).toBeLessThanOrEqual(ranges[i + 1][0] + 1e-3);
    }
  });

  it("renders a 3-word window centered on the active word", () => {
    const ass = buildAssFromWords(sampleWords);
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    // Event for "bốn" (index 2): window = ["hỏng", "bốn", "quả"]
    expect(events[2]).toContain("hỏng");
    expect(events[2]).toContain("bốn");
    expect(events[2]).toContain("quả");
    expect(events[2]).not.toContain("Vinícius"); // outside window
    expect(events[2]).not.toContain("penalty"); // outside window
  });

  it("clamps the window at the start (first word has no prev)", () => {
    const ass = buildAssFromWords(sampleWords);
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    // Event for "Vinícius" (index 0): window = ["Vinícius", "hỏng"]
    expect(events[0]).toContain("Vinícius");
    expect(events[0]).toContain("hỏng");
    expect(events[0]).not.toContain("bốn");
  });

  it("escapes ASS-significant chars in word text", () => {
    const tricky = [
      { w: "before{after}", start: 0, end: 0.5 },
      { w: "back\\slash", start: 0.5, end: 1.0 },
    ];
    const ass = buildAssFromWords(tricky);
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(events[0]).toContain("before\\{after\\}");
    expect(events[1]).toContain("back\\\\slash");
  });

  it("rejects invalid RGB hex", () => {
    expect(() => buildAssFromWords(sampleWords, { activeColorRgb: "xyz" })).toThrow();
  });
});
