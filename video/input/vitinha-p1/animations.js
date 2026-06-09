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
    tl.fromTo(scene, { opacity: 0 }, { opacity: 1, duration: FADE, ease: EASE.drawIn }, start);
    const fadeOutStart = isLast ? Math.max(start + 0.01, start + dur - FADE) : start + dur;
    tl.to(scene, { opacity: 0, duration: FADE, ease: EASE.drawIn }, fadeOutStart);

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
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: wordDur, ease: EASE.reveal },
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
    // Letterbox bars
    const lbTop = scene.querySelector(".hook-letterbox-top");
    const lbBot = scene.querySelector(".hook-letterbox-bottom");
    if (lbTop) tl.fromTo(lbTop, { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE.drawIn }, start);
    if (lbBot) tl.fromTo(lbBot, { opacity: 0, y: 30 },  { opacity: 1, y: 0, duration: 0.5, ease: EASE.drawIn }, start);

    // BIG STAT — punchy scale-in at ~0.12s, owns the hook. When present,
    // headline word reveal is delayed so the eye lands on bigStat first.
    const bigStat = scene.querySelector(".hook-bigstat");
    const headlineOffset = bigStat ? 0.95 : 0.5;
    if (bigStat) {
      tl.fromTo(
        bigStat,
        { opacity: 0, scale: 0.4 },
        { opacity: 1, scale: 1.0, duration: 0.55, ease: "back.out(2.4)" },
        start + 0.12,
      );
      tl.to(bigStat, { scale: 1.04, duration: 0.18, ease: "sine.inOut", yoyo: true, repeat: 1 }, start + 0.85);
    }

    // Eyebrow chip — delayed so it appears AFTER the hook lands (brand
    // recognition isn't earned at frame 0). Suppressed in HTML when bigStat
    // is present, so this is a no-op in that case.
    const eyebrow = scene.querySelector(".hook-eyebrow");
    if (eyebrow) tl.fromTo(eyebrow, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.4, ease: EASE.slide }, start + 1.6);

    // Per-word reveal on headline
    const wordEnd = animateWords(scene, ".hook-headline .hh-word", start + headlineOffset, 0.07, 0.5);

    // Shimmer sweep after words land
    const headlineEl = scene.querySelector(".hook-headline");
    if (headlineEl) {
      const mask = headlineEl.querySelector(".shimmer-mask");
      if (mask) tl.fromTo(mask, { x: "-120%" }, { x: "120%", duration: 1.0, ease: EASE.drawIn }, wordEnd + 0.05);
    }

    // Subhead + underline
    const subhead = scene.querySelector(".hook-subhead");
    if (subhead) tl.fromTo(subhead, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: EASE.slide }, wordEnd);
    animateUnderline(scene, ".hook-subhead .draw-underline", wordEnd + 0.4, 0.55);
  }

  // ── COMPARISON ────────────────────────────────────────────────────────
  function animateComparison(scene, tl, start) {
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
    // content panel slides up. Kinetic moment is the panel + value pop.

    // 1. Image — fade in only (Ken Burns is handled via CSS animation class on bg/img)
    const imageCard = scene.querySelector(".stat-hero-image-card");
    if (imageCard) {
      tl.fromTo(
        imageCard,
        { scale: 1.04, opacity: 0 },
        { scale: 1.0, opacity: 1, duration: 0.55, ease: EASE.drawIn },
        start + 0.0
      );
    }

    // 1b. Content panel slides up + fades — premium entrance
    const content = scene.querySelector(".stat-hero-content");
    if (content) {
      tl.fromTo(
        content,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.60, ease: EASE.drawIn },
        start + 0.35
      );
    }

    // 2. Value — overshoot scale-in for POP
    const value = scene.querySelector(".stat-value");
    const hasCounter = value && value.dataset.counterTo;
    if (value) {
      tl.fromTo(
        value,
        { scale: 0.55, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.55, ease: EASE.pop },
        start + 0.50
      );
    }
    if (hasCounter) {
      animateCounter(scene, start + 0.58);
    }

    // 3. Label fade-up + slide
    const label = scene.querySelector(".stat-label");
    if (label) {
      tl.fromTo(
        label,
        { y: 36, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.46, ease: EASE.slide },
        start + 0.82
      );
    }

    // 4. Highlights stagger slide-in from left (~90ms apart)
    const highlights = scene.querySelectorAll(".stat-highlight");
    highlights.forEach((h, i) => {
      tl.fromTo(
        h,
        { x: -32, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.40, ease: EASE.slide },
        start + 1.05 + i * 0.09
      );
    });

    // 5. Context badge fade-up last
    const context = scene.querySelector(".stat-context");
    if (context) {
      const ctxStart = start + 1.18 + Math.max(highlights.length, 1) * 0.09;
      tl.fromTo(
        context,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, ease: EASE.slide },
        ctxStart
      );
    }
  }

  // ── ENGAGEMENT QUESTION ───────────────────────────────────────────────
  function animateEngagementQuestion(scene, tl, start) {
    const card = scene.querySelector(".eq-card");
    if (card) {
      tl.fromTo(card, { y: 50, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.6, ease: EASE.pop }, start + 0.2);
    }
    const tag = scene.querySelector(".eq-tag");
    if (tag) {
      tl.fromTo(tag, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: EASE.pop }, start + 0.5);
    }
    // Word-by-word question reveal
    const wordEnd = animateWords(scene, ".eq-question .eq-word", start + 0.7, 0.05, 0.4);
    // Divider draw-in once question is in
    const divider = scene.querySelector(".eq-divider");
    if (divider) {
      tl.set(divider, { opacity: 1 }, wordEnd + 0.05);
      tl.fromTo(divider, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: EASE.drawIn }, wordEnd + 0.05);
    }
    // CTA pill last
    const cta = scene.querySelector(".eq-cta");
    if (cta) {
      tl.fromTo(cta, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: EASE.pop }, wordEnd + 0.35);
    }
  }

  // ── FORMATION PITCH ───────────────────────────────────────────────────
  function animateFormationPitch(scene, tl, start) {
    // Header — eyebrow stroke, title, formation label
    const eyebrow = scene.querySelector(".fp-eyebrow");
    if (eyebrow) {
      tl.fromTo(eyebrow, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: EASE.drawIn }, start + 0.05);
    }
    const title = scene.querySelector(".fp-title");
    if (title) {
      tl.fromTo(title, { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: EASE.slide }, start + 0.2);
    }
    const formation = scene.querySelector(".fp-formation");
    if (formation) {
      tl.fromTo(formation, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: EASE.pop }, start + 0.4);
    }
    // Pitch fades + scales into place
    const pitch = scene.querySelector(".fp-pitch");
    if (pitch) {
      tl.fromTo(pitch, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: EASE.pop }, start + 0.55);
    }
    // Players cascade in from back (GK row) → forward (ST row).
    // data-row counts from 0 = first row in DOM, which (with column-reverse)
    // sits at the BOTTOM of the pitch → that's the GK row in our convention.
    const rows = scene.querySelectorAll(".fp-row");
    const ROW_DELAY = 0.18;
    const TOKEN_STAGGER = 0.06;
    rows.forEach((row, rowIdx) => {
      const tokens = row.querySelectorAll(".fp-player");
      const rowStart = start + 1.0 + rowIdx * ROW_DELAY;
      tokens.forEach((p, i) => {
        tl.fromTo(
          p,
          { y: 24, scale: 0.55, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: EASE.pop },
          rowStart + i * TOKEN_STAGGER,
        );
      });
    });
  }

  // ── FEATURE LIST ──────────────────────────────────────────────────────
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
        { x: 80, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, ease: EASE.pop },
        start + 0.55 + i * 0.16
      );
    });
  }

  // ── CALLOUT v3 (full-bleed image + lower content panel) ───────────────
  function animateCallout(scene, tl, start) {
    // v3 (2026-05-26): full-bleed image fades in, content panel in lower
    // safe zone slides up, tag pill bounces, statement word-by-word reveals.

    // 1. Image fade-in
    const imageCard = scene.querySelector(".callout-image-card");
    if (imageCard) {
      tl.fromTo(
        imageCard,
        { scale: 1.04, opacity: 0 },
        { scale: 1.0, opacity: 1, duration: 0.65, ease: EASE.drawIn },
        start + 0.0
      );
    }

    // 2. Content panel slide-up + fade
    const content = scene.querySelector(".callout-content");
    if (content) {
      tl.fromTo(
        content,
        { y: 55, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.68, ease: EASE.drawIn },
        start + 0.40
      );
    }

    // 3. Tag pill scale-bounce
    const tag = scene.querySelector(".callout-tag");
    if (tag) {
      tl.fromTo(
        tag,
        { scale: 0.85, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.45, ease: EASE.pop },
        start + 0.85
      );
    }

    // 4. Statement word-by-word reveal
    animateWords(scene, ".callout-statement .co-word", start + 1.15, 0.06, 0.42);
  }

  // ── BIG QUOTE ─────────────────────────────────────────────────────────
  function animateBigQuote(scene, tl, start) {
    const card = scene.querySelector(".bq-card");
    if (card) {
      tl.fromTo(card, { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: EASE.pop }, start + 0.2);
    }
    const mark = scene.querySelector(".bq-mark");
    if (mark) {
      tl.fromTo(mark, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: EASE.pop }, start + 0.45);
    }
    const wordEnd = animateWords(scene, ".bq-quote .bq-word", start + 0.7, 0.05, 0.4);

    const attribution = scene.querySelector(".bq-attribution");
    if (attribution) {
      tl.fromTo(attribution, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: EASE.slide }, wordEnd + 0.1);
    }
  }

  // ── TIMELINE ──────────────────────────────────────────────────────────
  function animateTimeline(scene, tl, start) {
    const title = scene.querySelector(".tl-title");
    if (title) {
      tl.fromTo(title, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: EASE.slide }, start + 0.15);
    }
    const spine = scene.querySelector(".tl-spine");
    if (spine) {
      tl.fromTo(spine, { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: EASE.drawIn }, start + 0.5);
    }
    const items = scene.querySelectorAll(".tl-item");
    items.forEach((it, i) => {
      const isOdd = i % 2 === 0; // nth-child is 1-indexed, array is 0-indexed
      const slideX = isOdd ? -60 : 60;
      tl.fromTo(
        it,
        { x: slideX, opacity: 0, scale: 0.92 },
        { x: 0, opacity: 1, scale: 1, duration: 0.55, ease: EASE.pop },
        start + 0.9 + i * 0.25
      );
      // Dot pop
      const dot = it.querySelector(".tl-dot");
      if (dot) {
        tl.fromTo(dot,
          { scale: 0 },
          { scale: 1, duration: 0.3, ease: EASE.pop },
          start + 1.05 + i * 0.25
        );
      }
    });
  }

  // ── OUTRO ─────────────────────────────────────────────────────────────
  function animateOutro(scene, tl, start, dur) {
    const cta = scene.querySelector(".out-cta-top");
    if (cta) {
      tl.fromTo(cta, { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE.pop }, start + 0.2);
    }
    const channel = scene.querySelector(".out-channel");
    if (channel) {
      tl.fromTo(channel, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: EASE.pop }, start + 0.55);
    }
    const underline = scene.querySelector(".out-underline");
    if (underline) {
      tl.fromTo(underline, { width: 0 }, { width: "600px", duration: 0.55, ease: EASE.drawIn }, start + 0.95);
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
      const ttFollwing = scene.querySelector("#tt-btn-following");
      const ttBase     = start + 1.6;

      tl.fromTo(ttCard,
        { opacity: 0, y: 300 },
        { opacity: 1, y: 0, duration: 0.55, ease: EASE.pop },
        ttBase
      );

      if (ttBtn) {
        tl.to(ttBtn, { scale: 0.92, duration: 0.15 }, ttBase + 0.9);
        tl.to(ttBtn, { scale: 1, duration: 0.4, ease: EASE.pop }, ttBase + 1.05);
      }
      if (ttFollow)   tl.to(ttFollow,   { opacity: 0, duration: 0.08 }, ttBase + 1.05);
      if (ttFollwing) tl.to(ttFollwing, { opacity: 1, duration: 0.08 }, ttBase + 1.08);

      const holdStart = ttBase + 1.3;
      const holdEnd   = start + dur - 0.1;
      const holdLen   = Math.max(0.5, holdEnd - holdStart);
      tl.to(ttCard, { scale: 1.08, duration: holdLen }, holdStart);
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
})();
