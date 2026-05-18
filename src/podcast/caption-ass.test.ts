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

  it("emits scale-pop animation override on the active word by default", () => {
    const ass = buildAssFromWords(sampleWords);
    const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    // Default popScale=118, popDurationMs=90 → expect \t(0,90,\fscx118\fscy118)
    expect(events[0]).toContain("\\fscx100\\fscy100");
    expect(events[0]).toContain("\\t(0,90,\\fscx118\\fscy118)");
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
