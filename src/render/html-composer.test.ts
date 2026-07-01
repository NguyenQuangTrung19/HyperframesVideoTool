import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { composeHtml } from "./html-composer.js";
import type { Script } from "./script-schema.js";

describe("composeHtml", () => {
  it("produces deterministic HTML for sample script with image", () => {
    const script = JSON.parse(readFileSync("tests/fixtures/sample-script-with-image.json", "utf8")) as Script;
    const sceneAudio = [
      { id: "hook",   durationSec: 3.2 },
      { id: "body-1", durationSec: 11.5 },
      { id: "body-2", durationSec: 10.8 },
      { id: "body-3", durationSec: 12.1 },
      { id: "outro",  durationSec: 3.4 },
    ];
    const html = composeHtml({
      script,
      sceneAudio,
      gapSec: 0.3,
      sceneImages: { hook: "images/bg.jpg" },
      audioRelPath: "voice.mp3",
    });

    // ── HyperFrames structural requirements ──────────────────
    expect(html).toContain('id="stage"');
    expect(html).toContain('data-composition-id="news-video"');
    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1920"');
    expect(html).toContain('data-start="0"');           // root composition timing
    expect(html).toContain('id="voice"');               // audio element discoverable by hyperframes
    expect(html).toContain('class="scene clip"');       // clip class required for hyperframes visibility
    expect(html).toContain('src="animations.js"');       // timeline registry (external JS)

    // ── Persistent brand shell ────────────────────────────────
    expect(html).toContain('class="brand-shell-header"');
    expect(html).not.toContain('id="grain-overlay"'); // grain layer removed 2026-06-10 (video bị đục)
    // Shell has no data-start (persistent)
    expect(html).toContain('class="brand-name"');
    expect(html).toContain("SportsForAllTV");

    // ── Hook scene ─────────────────────────────────────────────
    expect(html).toContain('data-layout="hook"');
    expect(html).toContain('class="hook-headline"');
    expect(html).toContain("iPhone 17");                // headline content
    expect(html).toContain("Camera 200MP!");            // subhead content

    // Image background (hook has bgSrc + bgImageRelPath provided)
    expect(html).toContain('class="bg kb-zoom-in"');
    expect(html).toContain("background-image: url('images/bg.jpg')");

    // ── Body templates ─────────────────────────────────────────
    // body-1: stat-hero
    expect(html).toContain('data-layout="stat-hero"');
    expect(html).toContain('class="stat-value"');
    expect(html).toContain('class="stat-label"');
    expect(html).toContain("200MP");

    // body-2: feature-list
    expect(html).toContain('data-layout="feature-list"');
    expect(html).toContain('class="feat-card"');
    expect(html).toContain('class="feat-title"');
    expect(html).toContain("Nâng cấp lớn");

    // body-3: callout
    expect(html).toContain('data-layout="callout"');
    expect(html).toContain('class="layout-callout"');
    expect(html).toContain('class="callout-statement"');

    // ── Outro scene ────────────────────────────────────────────
    expect(html).toContain('data-layout="outro"');
    expect(html).toContain('class="out-channel"');
    expect(html).toContain('class="out-underline"');
    expect(html).toContain("Theo dõi ngay");            // ctaTop content
    expect(html).toContain('class="out-cta-top"');

    // Audio src
    expect(html).toContain('src="voice.mp3"');
    expect(html).toMatch(/data-duration="[\d.]+"/);

    // Google Fonts present
    expect(html).toContain("fonts.googleapis.com");
  });

  it("falls back to gradient when sceneImages is empty", () => {
    const script = JSON.parse(readFileSync("tests/fixtures/sample-script-with-image.json", "utf8")) as Script;
    const sceneAudio = script.scenes.map((s) => ({ id: s.id, durationSec: 5 }));
    const html = composeHtml({
      script,
      sceneAudio,
      gapSec: 0.3,
      sceneImages: {},
      audioRelPath: "voice.mp3",
    });
    // No image for any scene → all use gradient
    expect(html).toContain('class="bg gradient-news-dark"');
    expect(html).not.toContain("background-image: url");
  });
});

describe("landscape image → framed hero card", () => {
  function oneScene(template: "stat-hero" | "callout" | "hook"): Script {
    const templateData =
      template === "stat-hero"
        ? { template, value: "19", label: "Bruno" }
        : template === "callout"
          ? { template, statement: "X." }
          : { template, headline: "X" };
    return {
      metadata: { title: "t", channel: "SportsForAllTV" },
      source: { url: "local", domain: "local", image: null },
      voice: { provider: "ausynclab", voiceId: "1", speed: 1 },
      scenes: [{ id: "s1", type: "body", voiceText: "x", templateData }],
    } as unknown as Script;
  }
  const compose = (t: "stat-hero" | "callout" | "hook", aspect: number | undefined) =>
    composeHtml({
      script: oneScene(t),
      sceneAudio: [{ id: "s1", durationSec: 5 }],
      gapSec: 0.3,
      sceneImages: { s1: "s1.jpg" },
      sceneImageAspect: aspect === undefined ? {} : { s1: aspect },
      audioRelPath: "voice.mp3",
    });

  it("stat-hero with a landscape image renders the card + data-fit=card", () => {
    const html = compose("stat-hero", 1.6);
    expect(html).toContain('data-fit="card"');
    expect(html).toContain('class="bg-card"');
    expect(html).toContain("aspect-ratio: 1.600");
    expect(html).toContain("bg-card-img kb-card-zoom");
  });

  it("callout with a landscape image uses card fit", () => {
    const html = compose("callout", 1.78);
    expect(html).toContain('data-fit="card"');
    expect(html).toContain('class="bg-card"');
  });

  it("portrait image keeps full-bleed cover (no card)", () => {
    const html = compose("stat-hero", 0.667);
    expect(html).toContain('data-fit="cover"');
    expect(html).not.toContain('class="bg-card"');
  });

  it("unknown aspect keeps cover", () => {
    const html = compose("stat-hero", undefined);
    expect(html).toContain('data-fit="cover"');
    expect(html).not.toContain('class="bg-card"');
  });

  it("hook stays on cover even for a landscape image (portrait posters only)", () => {
    const html = compose("hook", 1.9);
    expect(html).toContain('data-fit="cover"');
    expect(html).not.toContain('class="bg-card"');
  });

  it("aspect just below threshold stays cover", () => {
    expect(compose("stat-hero", 1.04)).toContain('data-fit="cover"');
  });

  it("ultra-wide aspect is clamped to 1.900", () => {
    const html = compose("stat-hero", 3.2);
    expect(html).toContain("aspect-ratio: 1.900");
  });
});
