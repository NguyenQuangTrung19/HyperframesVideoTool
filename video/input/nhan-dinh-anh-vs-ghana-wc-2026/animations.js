// v2 Animation Engine — template-specific entrance animations
// HyperFrames runtime drives playback by seeking the timeline.
//
// IMPORTANT: Only use supported GSAP props: opacity, x, y, scale, scaleX, scaleY,
// rotation, width, height, visibility, color, backgroundColor, fontSize, strokeDashoffset.
// Do NOT use `delay:` in vars — use position parameter (3rd arg) instead.
// Do NOT use `attr:` settings.

window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
window.__timelines["news-video"] = tl;

// Easings — used throughout. expoOut for big reveals; power3 for scales;
// power2.inOut for slides. Anything left implicit defaults to power1.out.
const EASE = {
  reveal: "expo.out",
  pop:    "power3.out",
  slide:  "power2.out",
  drawIn: "power2.inOut",
  count:  "power2.out",
};

(function () {
  // ── Inject shimmer masks into all .shimmer-sweep-target elements ──────────
  document.querySelectorAll(".shimmer-sweep-target").forEach((el) => {
    if (!el.querySelector(".shimmer-mask")) {
      const mask = document.createElement("div");
      mask.className = "shimmer-mask";
      el.appendChild(mask);
    }
  });

  const stage = document.getElementById("stage");
  const scenes = Array.from(stage.querySelectorAll(".scene"));
  const FADE = 0.3; // scene crossfade overlap, in seconds

  // ── Scene dispatch ──────────────────────────────────────────────────────
  scenes.forEach((scene, idx) => {
    const start = parseFloat(scene.dataset.start);
    const dur   = parseFloat(scene.dataset.duration);
    const layout = scene.dataset.layout;
    const isLast = idx === scenes.length - 1;

    // Scene visibility: fade-in at start, fade-out into next scene for true crossfade.
    // Scene entrance — per-type cinematic transition (Phase 1 visual overhaul)
    const ENTER_DUR = 0.42;
    if (layout === 'hook') {
      tl.fromTo(scene, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.50, ease: EASE.pop }, start);
    } else if (layout === 'stat-hero' || layout === 'callout') {
      tl.fromTo(scene, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: ENTER_DUR, ease: EASE.slide }, start);
    } else if (layout === 'big-quote') {
      tl.fromTo(scene, { opacity: 0, scale: 1.10 }, { opacity: 1, scale: 1, duration: 0.50, ease: EASE.pop }, start);
    } else if (layout === 'engagement-question') {
      tl.fromTo(scene, { opacity: 0, scale: 0.90 }, { opacity: 1, scale: 1, duration: 0.50, ease: "back.out(1.7)" }, start);
    } else if (layout === 'outro') {
      tl.fromTo(scene, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.55, ease: EASE.drawIn }, start);
    } else if (layout === 'group-intro' || layout === 'match-results') {
      tl.fromTo(scene, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: ENTER_DUR, ease: EASE.slide }, start);
    } else {
      tl.fromTo(scene, { opacity: 0 }, { opacity: 1, duration: FADE, ease: EASE.drawIn }, start);
    }

    // Scene exit — scale-down + fade for mid scenes (Phase 1 visual overhaul)
    const fadeOutStart = isLast ? Math.max(start + 0.01, start + dur - FADE) : start + dur;
    if (!isLast) {
      tl.to(scene, { opacity: 0, scale: 0.94, duration: FADE + 0.15, ease: EASE.drawIn }, fadeOutStart);
    } else {
      tl.to(scene, { opacity: 0, duration: FADE, ease: EASE.drawIn }, fadeOutStart);
    }

    if (layout === "hook") {
      animateHook(scene, tl, start);
    } else if (layout === "comparison") {
      animateComparison(scene, tl, start);
    } else if (layout === "stat-hero") {
      animateStatHero(scene, tl, start);
    } else if (layout === "feature-list") {
      animateFeatureList(scene, tl, start);
    } else if (layout === "callout") {
      animateCallout(scene, tl, start);
    } else if (layout === "big-quote") {
      animateBigQuote(scene, tl, start);
    } else if (layout === "timeline") {
      animateTimeline(scene, tl, start);
    } else if (layout === "formation-pitch") {
      animateFormationPitch(scene, tl, start);
    } else if (layout === "group-intro") {
      animateGroupIntro(scene, tl, start);
    } else if (layout === "match-results") {
      animateMatchResults(scene, tl, start);
    } else if (layout === "engagement-question") {
      animateEngagementQuestion(scene, tl, start);
    } else if (layout === "outro") {
      animateOutro(scene, tl, start, dur);
    }
  });

  // ── Per-word stagger helper ─────────────────────────────────────────────
  function animateWords(scene, selector, baseStart, perWordStagger, wordDur) {
    const words = scene.querySelectorAll(selector);
    words.forEach((w, i) => {
      tl.fromTo(
        w,
        { y: 40, opacity: 0, scale: 0.88, rotation: -3 },
        { y: 0, opacity: 1, scale: 1, rotation: 0, duration: wordDur, ease: EASE.reveal },
        baseStart + i * perWordStagger
      );
    });
    const total = words.length === 0 ? 0 : (words.length - 1) * perWordStagger + wordDur;
    return baseStart + total;
  }

  // ── Draw-in underline helper ────────────────────────────────────────────
  function animateUnderline(scene, selector, start, duration = 0.6) {
    const u = scene.querySelector(selector);
    if (!u) return;
    tl.set(u, { opacity: 1 }, start);
    tl.fromTo(u, { scaleX: 0 }, { scaleX: 1, duration, ease: EASE.drawIn }, start);
  }

  // ── Counter (number tween) helper ───────────────────────────────────────
  function animateCounter(scene, start) {
    const valEl = scene.querySelector(".stat-value[data-counter-to]");
    if (!valEl) return;
    const target = parseInt(valEl.dataset.counterTo, 10);
    if (!Number.isFinite(target) || target <= 0) return;
    const textEl = valEl.querySelector(".stat-value-text");
    if (!textEl) return;
    const counter = { n: 0 };
    tl.to(counter, {
      n: target,
      duration: 1.1,
      ease: EASE.count,
      onUpdate: () => { textEl.textContent = Math.round(counter.n).toString(); },
    }, start);
  }

  // ── FX flash helper ─────────────────────────────────────────────────────
  function flashFx(scene, selector, start, peakOpacity, totalDur) {
    const fx = scene.querySelector(selector);
    if (!fx) return;
    tl.fromTo(fx, { opacity: 0 }, { opacity: peakOpacity, duration: totalDur * 0.25, ease: EASE.drawIn }, start);
    tl.to(fx, { opacity: 0, duration: totalDur * 0.75, ease: EASE.drawIn }, start + totalDur * 0.25);
  }

  // ── HOOK ──────────────────────────────────────────────────────────────
  function animateHook(scene, tl, start) {
    // Kicker (competition strap) — slide in from the left, broadcast lower-third feel.
    const kicker = scene.querySelector(".hook-kicker");
    if (kicker) tl.fromTo(kicker, { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.5, ease: EASE.slide }, start + 0.10);

    // BIG STAT — punchy scale-in; headline word reveal delayed so the eye lands
    // on the score/number first.
    const bigStat = scene.querySelector(".hook-bigstat");
    const headlineOffset = bigStat ? 0.85 : 0.5;
    if (bigStat) {
      tl.fromTo(
        bigStat,
        { opacity: 0, scale: 0.3, y: 20 },
        { opacity: 1, scale: 1.0, y: 0, duration: 0.6, ease: "back.out(2.4)" },
        start + 0.28,
      );
      // Single emphasis pump after landing
      tl.to(bigStat, { scale: 1.05, duration: 0.12, ease: "power2.in" }, start + 0.92);
      tl.to(bigStat, { scale: 1.0, duration: 0.18, ease: "sine.inOut" }, start + 1.04);
    }

    // Red accent bar — draw out from the left after the stat lands.
    const statbar = scene.querySelector(".hook-statbar");
    if (statbar) tl.fromTo(statbar, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.45, ease: EASE.drawIn }, start + (bigStat ? 0.75 : 0.4));

    // Per-word reveal on headline
    const wordEnd = animateWords(scene, ".hook-headline .hh-word", start + headlineOffset, 0.07, 0.5);

    // Subhead — appears after the headline words land
    const subhead = scene.querySelector(".hook-subhead");
    if (subhead) tl.fromTo(subhead, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: EASE.slide }, wordEnd - 0.05);

    // Brand Logo/Header slide-in from top-left (persistent shell logo element)
    const brandHeader = document.querySelector(".brand-shell-header");
    if (brandHeader) {
      tl.fromTo(brandHeader, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5, ease: EASE.slide }, start + 1.4);
    }
  }

  // ── COMPARISON ────────────────────────────────────────────────────────
  function animateComparison(scene, tl, start) {
    // Score variant (predicted scoreline + flags)
    if (scene.querySelector(".layout-comparison-score")) {
      const eyebrow = scene.querySelector(".cs-eyebrow");
      if (eyebrow) tl.fromTo(eyebrow, { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: EASE.slide }, start);
      const left = scene.querySelector(".cs-left");
      if (left) tl.fromTo(left, { x: -70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: EASE.pop }, start + 0.2);
      const right = scene.querySelector(".cs-right");
      if (right) tl.fromTo(right, { x: 70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: EASE.pop }, start + 0.35);
      const score = scene.querySelector(".cs-score");
      if (score) tl.fromTo(score, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.7)" }, start + 0.55);
      const foot = scene.querySelector(".cs-foot");
      if (foot) tl.fromTo(foot, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: EASE.drawIn }, start + 1.1);
      return;
    }

    // Chart variant
    if (scene.querySelector(".layout-comparison-chart")) {
      const rows = scene.querySelectorAll(".cmp-row");
      rows.forEach((row, i) => {
        const rowStart = start + 0.2 + i * 0.18;
        // Row enters
        tl.fromTo(row, { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: EASE.slide }, rowStart);
        // Bar fill
        const fill = row.querySelector(".cmp-bar-fill");
        if (fill) {
          const pct = parseFloat(fill.dataset.pct);
          if (Number.isFinite(pct)) {
            tl.fromTo(fill, { width: "0%" }, { width: pct + "%", duration: 1.0, ease: EASE.pop }, rowStart + 0.2);
          }
        }
        // Number count-up inside this row
        const num = row.querySelector(".cmp-num");
        if (num) {
          const target = parseInt(num.dataset.target, 10);
          if (Number.isFinite(target) && target > 0) {
            const c = { n: 0 };
            tl.to(c, {
              n: target,
              duration: 1.0,
              ease: EASE.count,
              onUpdate: () => { num.textContent = Math.round(c.n).toString(); },
            }, rowStart + 0.2);
          }
        }
      });
      // Delta callout
      const delta = scene.querySelector(".cmp-delta");
      if (delta) {
        tl.fromTo(delta, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: EASE.slide }, start + 1.5);
      }
      return;
    }

    // Cards fallback (legacy 2-card layout for non-numeric comparisons)
    const leftCard = scene.querySelector(".cmp-card.cmp-left");
    if (leftCard) {
      tl.fromTo(leftCard, { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: EASE.pop }, start + 0.15);
    }
    const vs = scene.querySelector(".cmp-vs");
    if (vs) {
      tl.fromTo(vs, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: EASE.pop }, start + 0.5);
    }
    const rightCard = scene.querySelector(".cmp-card.cmp-right");
    if (rightCard) {
      tl.fromTo(rightCard, { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: EASE.pop }, start + 0.7);
    }
  }

  // ── STAT HERO ─────────────────────────────────────────────────────────
  function animateStatHero(scene, tl, start) {
    // v4 (2026-05-26): FULL-BLEED image (subtle Ken Burns) + lower-safe-zone
    // content panel. Kinetic moment is the value pop.

    // 1. Image — fade in only (Ken Burns is handled via CSS animation class on bg)
    // We do NOT animate scale here to prevent overriding CSS keyframes.
    const imageCard = scene.querySelector(".stat-hero-image-card");
    if (imageCard) {
      tl.fromTo(
        imageCard,
        { opacity: 0 },
        { opacity: 1, duration: 0.55, ease: EASE.drawIn },
        start + 0.0
      );
    }

    // 2. Value — overshoot scale-in for POP (ease back.out(2.5), duration 0.7s at start + 0.3)
    const value = scene.querySelector(".stat-value");
    const hasCounter = value && value.dataset.counterTo;
    if (value) {
      tl.fromTo(
        value,
        { scale: 0.3, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.7, ease: "back.out(2.5)" },
        start + 0.3
      );
    }
    if (hasCounter) {
      animateCounter(scene, start + 0.3);
    }

    // 3. Divider — draws in between value and label at start + 0.8
    const divider = scene.querySelector(".sh2-divider");
    if (divider) {
      tl.fromTo(
        divider,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.5, ease: EASE.slide },
        start + 0.8
      );
    }

    // 4. Label fade-up + slide at start + 1.0
    const label = scene.querySelector(".stat-label");
    if (label) {
      tl.fromTo(
        label,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, ease: EASE.slide },
        start + 1.0
      );
    }

    // 5. Context badge fade-up last at start + 1.15
    const context = scene.querySelector(".stat-context");
    if (context) {
      tl.fromTo(
        context,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: EASE.slide },
        start + 1.15
      );
    }

    // 6. Highlights stagger slide-in from left/scale-pop (~120ms apart) starting at start + 1.35
    const highlights = scene.querySelectorAll(".stat-highlight");
    highlights.forEach((h, i) => {
      tl.fromTo(
        h,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.6)" },
        start + 1.35 + i * 0.12
      );
    });
  }

  // ── ENGAGEMENT QUESTION ───────────────────────────────────────────────
  function animateEngagementQuestion(scene, tl, start) {
    const card = scene.querySelector(".eq-card");
    if (card) {
      tl.fromTo(card, { y: 40, scale: 0.9, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.8)" }, start + 0.2);
    }
    const tag = scene.querySelector(".eq-tag");
    if (tag) {
      tl.fromTo(tag, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.5)" }, start + 0.5);
    }
    // Word-by-word question reveal
    const wordEnd = animateWords(scene, ".eq-question .eq-word", start + 0.65, 0.055, 0.28);
    // Divider draw-in once question is in
    const divider = scene.querySelector(".eq-divider");
    if (divider) {
      tl.fromTo(divider, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.4, ease: EASE.slide }, start + 1.2);
    }
    // CTA pill last
    const cta = scene.querySelector(".eq-cta");
    if (cta) {
      tl.fromTo(cta, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: EASE.slide }, start + 1.4);
    }
  }

  // ── FORMATION PITCH ───────────────────────────────────────────────────
  function animateFormationPitch(scene, tl, start) {
    // Header — eyebrow stroke, title, formation label
    const eyebrow = scene.querySelector(".fp-eyebrow");
    if (eyebrow) {
      tl.fromTo(eyebrow, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: EASE.slide }, start + 0.1);
    }
    const title = scene.querySelector(".fp-title");
    if (title) {
      tl.fromTo(title, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: EASE.slide }, start + 0.2);
    }
    const formation = scene.querySelector(".fp-formation");
    if (formation) {
      tl.fromTo(formation, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.5)" }, start + 0.35);
    }
    // Pitch fades + scales into place
    const pitch = scene.querySelector(".fp-pitch");
    if (pitch) {
      tl.fromTo(pitch, { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: EASE.slide }, start + 0.5);
    }
    // Players cascade in from back (GK row) → forward (ST row) with soccer-specific grid alignment
    const rows = scene.querySelectorAll(".fp-row");
    const ROW_DELAY = 0.15;
    const TOKEN_STAGGER = 0.05;
    rows.forEach((row, rowIdx) => {
      const tokens = row.querySelectorAll(".fp-player");
      const rowStart = start + 0.7 + rowIdx * ROW_DELAY;
      tokens.forEach((p, i) => {
        tl.fromTo(
          p,
          { scale: 0.5, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.5)" },
          rowStart + i * TOKEN_STAGGER,
        );
      });
    });
  }

  // ── FEATURE LIST ──────────────────────────────────────────────────────
  function animateGroupIntro(scene, tl, start) {
    const eb = scene.querySelector(".gi-eyebrow");
    if (eb) tl.fromTo(eb, { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: EASE.slide }, start + 0.1);
    const grp = scene.querySelector(".gi-group");
    if (grp) tl.fromTo(grp, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.5)" }, start + 0.2);
    const rule = scene.querySelector(".gi-rule");
    if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: EASE.drawIn }, start + 0.42);
    const rows = scene.querySelectorAll(".gi-team");
    rows.forEach((r, i) => {
      tl.fromTo(r, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)" }, start + 0.5 + i * 0.16);
    });
    const foot = scene.querySelector(".gi-foot");
    if (foot) tl.fromTo(foot, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: EASE.drawIn }, start + 0.6 + rows.length * 0.16);
  }

  function animateMatchResults(scene, tl, start) {
    const eb = scene.querySelector(".mr-eyebrow");
    if (eb) tl.fromTo(eb, { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: EASE.slide }, start + 0.1);
    const title = scene.querySelector(".mr-title");
    if (title) tl.fromTo(title, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.5)" }, start + 0.2);
    const sub = scene.querySelector(".mr-sub");
    if (sub) tl.fromTo(sub, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: EASE.drawIn }, start + 0.38);
    const rule = scene.querySelector(".mr-rule");
    if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: EASE.drawIn }, start + 0.46);
    const rows = scene.querySelectorAll(".mr-row");
    rows.forEach((r, i) => {
      tl.fromTo(r, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: "back.out(1.3)" }, start + 0.5 + i * 0.12);
    });
    const foot = scene.querySelector(".mr-foot");
    if (foot) tl.fromTo(foot, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: EASE.drawIn }, start + 0.6 + rows.length * 0.12);
  }

  function animateFeatureList(scene, tl, start) {
    // Header eyebrow stroke
    const eyebrow = scene.querySelector(".feat-eyebrow");
    if (eyebrow) {
      tl.fromTo(eyebrow, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: EASE.drawIn }, start + 0.1);
    }
    // Title
    const title = scene.querySelector(".feat-title");
    if (title) {
      tl.fromTo(title, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: EASE.slide }, start + 0.25);
    }
    // Numbered cards — slide from right with stagger
    const cards = scene.querySelectorAll(".feat-card");
    cards.forEach((card, i) => {
      tl.fromTo(
        card,
        { x: 80, opacity: 0, scale: 0.92 },
        { x: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.4)" },
        start + 0.55 + i * 0.18
      );
    });
  }

  // ── CALLOUT v3 (full-bleed image + lower content panel) ───────────────
  function animateCallout(scene, tl, start) {
    // v3 (2026-05-26): full-bleed image fades in, content panel in lower
    // safe zone slides up, tag pill bounces, statement word-by-word reveals.

    // 1. Image fade-in (no scale animation to prevent overriding CSS keyframes)
    const imageCard = scene.querySelector(".callout-image-card");
    if (imageCard) {
      tl.fromTo(
        imageCard,
        { opacity: 0 },
        { opacity: 1, duration: 0.65, ease: EASE.drawIn },
        start + 0.0
      );
    }

    // 2. Content panel slide-up + fade (subtle backdrop slide)
    const content = scene.querySelector(".callout-content");
    if (content) {
      tl.fromTo(
        content,
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.40, ease: EASE.drawIn },
        start + 0.10
      );
    }

    // 3. Tag pill scale-bounce
    const tag = scene.querySelector(".callout-tag");
    if (tag) {
      tl.fromTo(
        tag,
        { scale: 0.9, opacity: 0, y: 15 },
        { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: "back.out(1.5)" },
        start + 0.2
      );
    }

    // 4. Statement word-by-word reveal (aligned to 0.5s start and 0.3s word duration)
    animateWords(scene, ".callout-statement .co-word", start + 0.5, 0.06, 0.30);
  }

  // ── BIG QUOTE ─────────────────────────────────────────────────────────
  function animateBigQuote(scene, tl, start) {
    const card = scene.querySelector(".bq-card");
    if (card) {
      tl.fromTo(card, { y: 60, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.65, ease: "back.out(1.5)" }, start + 0.2);
    }
    const mark = scene.querySelector(".bq-mark");
    if (mark) {
      tl.fromTo(mark, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.0)" }, start + 0.4);
    }
    animateWords(scene, ".bq-quote .bq-word", start + 0.6, 0.06, 0.30);

    const attribution = scene.querySelector(".bq-attribution");
    if (attribution) {
      tl.fromTo(attribution, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: EASE.slide }, start + 1.5);
    }
  }

  // ── TIMELINE ──────────────────────────────────────────────────────────
  function animateTimeline(scene, tl, start) {
    const title = scene.querySelector(".tl-title");
    if (title) {
      tl.fromTo(title, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: EASE.slide }, start + 0.1);
    }
    const spine = scene.querySelector(".tl-spine");
    if (spine) {
      tl.fromTo(spine, { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: EASE.slide }, start + 0.3);
    }
    const items = scene.querySelectorAll(".tl-item");
    items.forEach((it, i) => {
      const isOdd = i % 2 === 0;
      const slideX = isOdd ? -30 : 30;
      tl.fromTo(
        it,
        { x: slideX, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, ease: "back.out(1.3)" },
        start + 0.6 + i * 0.2
      );
    });
  }

  // ── OUTRO ─────────────────────────────────────────────────────────────
  function animateOutro(scene, tl, start, dur) {
    const cta = scene.querySelector(".out-cta-top");
    if (cta) {
      tl.fromTo(cta, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.5)" }, start + 0.2);
    }
    const channel = scene.querySelector(".out-channel");
    if (channel) {
      tl.fromTo(channel, { y: 25, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: EASE.slide }, start + 0.5);
    }
    const underline = scene.querySelector(".out-underline");
    if (underline) {
      tl.fromTo(underline, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: EASE.slide }, start + 0.8);
    }
    const source = scene.querySelector(".out-source");
    if (source) {
      tl.fromTo(source, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: EASE.slide }, start + 1.35);
    }

    // ── TikTok follow card animation ────────────────────────────────────
    const ttCard = scene.querySelector("#tt-card");
    if (ttCard) {
      const ttBtn      = scene.querySelector("#tt-follow-btn");
      const ttFollow   = scene.querySelector("#tt-btn-follow");
      const ttFollowing = scene.querySelector("#tt-btn-following");
      const ttBase     = start + 1.1;

      tl.fromTo(ttCard,
        { opacity: 0, y: 150, scale: 1 },
        { opacity: 1, y: 0, duration: 0.55, ease: "back.out(1.5)" },
        ttBase
      );

      if (ttBtn) {
        tl.to(ttBtn, { scale: 0.88, duration: 0.12 }, start + 1.9);
        tl.to(ttBtn, { scale: 1, duration: 0.3, ease: "back.out(1.8)" }, start + 2.02);
      }
      if (ttFollow)   tl.to(ttFollow,   { opacity: 0, duration: 0.06 }, start + 2.02);
      if (ttFollowing) tl.to(ttFollowing, { opacity: 1, duration: 0.06 }, start + 2.05);

      const holdStart = start + 2.2;
      const holdEnd   = start + dur - 0.1;
      const holdLen   = Math.max(0.5, holdEnd - holdStart);
      tl.to(ttCard, { scale: 1.05, duration: holdLen, ease: "sine.out" }, holdStart);
    }
  }

  // ── PROGRESS BAR ANIMATION ──────────────────────────────────────────────
  // Sync progress-fill width and progress-dot position with scene timeline.
  const progressFill = document.getElementById("progress-fill");
  const progressDot  = document.getElementById("progress-dot");
  if (progressFill && progressDot && scenes.length > 0) {
    const totalDur = parseFloat(stage.dataset.duration) || 1;
    scenes.forEach((scene) => {
      const sStart = parseFloat(scene.dataset.start);
      const sDur   = parseFloat(scene.dataset.duration);
      const endPct = ((sStart + sDur) / totalDur) * 100;
      const pctStr = Math.min(100, endPct).toFixed(1) + "%";
      // Animate fill width to reach scene end percentage
      tl.to(progressFill, { width: pctStr, duration: sDur, ease: "none" }, sStart);
      tl.to(progressDot,  { left: pctStr, duration: sDur, ease: "none" }, sStart);
    });
  }

  // Dev utility: Auto-seek if query parameter is present (e.g. ?seek=18.0)
  const urlParams = new URLSearchParams(window.location.search);
  const seekTime = urlParams.get('seek');
  if (seekTime !== null) {
    const t = parseFloat(seekTime);
    if (!isNaN(t)) {
      tl.seek(t);
    }
  }
})();
