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

// ── EASING VOCABULARY ───────────────────────────────────────────────────────
// One name per JOB, so a scene never has to pick a curve by feel. Expanded
// 2026-07-27 ("chuyển động mượt mà, nhiều skill chuyển động hơn"): the old set
// was five curves doing everything, so every element on every scene moved with
// the same personality and the whole video read stiff.
//
// The rule that keeps it from turning to mush: HEAVY things get long, soft,
// decelerating curves (a photo card is heavy); SMALL things get short, snappy,
// slightly overshooting ones (a chip, a dot, a bullet). Mixing that up is what
// makes motion feel cheap — a 900px card that boings, or a 40px dot that
// glides in over 700ms.
const EASE = {
  reveal: "expo.out",          // big text reveals — fast out of the gate, long tail
  pop:    "power3.out",        // scale-ins with authority
  slide:  "power2.out",        // lateral / vertical slides
  drawIn: "power2.inOut",      // lines drawing, symmetrical fades
  count:  "power2.out",        // number tweens

  // NEW ─────────────────────────────────────────────────────────────────────
  /** Heavy objects settling — photo cards, boards. Very long tail, no bounce. */
  settle: "expo.out",
  /** The glide used for anything that drifts for the WHOLE scene (parallax,
   *  push-in). Near-linear on purpose: an eased drift visibly slows down
   *  mid-scene and reads as a stutter. */
  drift:  "none",
  /** Small UI that should feel springy — chips, dots, tick nodes. */
  spring: "back.out(2.2)",
  /** Same, gentler — for things big enough that a real overshoot looks silly. */
  nudge:  "back.out(1.25)",
  /** Anticipation: pulls back before it goes. Use on ONE element per scene. */
  anticipate: "back.in(1.6)",
  /** Exits. Accelerating, so leaving feels deliberate rather than a fade-out. */
  exit:   "power2.in",
};

/**
 * Continuous slow motion for the whole life of a scene.
 *
 * Every "living" background move goes through here rather than a CSS
 * @keyframes, because CSS animations run on the WALL CLOCK while HyperFrames
 * renders by seeking this GSAP timeline — so a CSS drift is not reproducible
 * frame to frame, and two renders of the same second can differ. On the
 * timeline it is exact.
 */
function drift(tl, el, from, to, start, dur) {
  if (!el) return;
  tl.fromTo(el, from, { ...to, duration: dur, ease: EASE.drift }, start);
}

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
  // Crossfade overlap. Raised 0.3 → 0.46 (2026-07-27): at 0.3 the outgoing
  // scene was gone before the incoming one had travelled, so cuts read as a
  // blink rather than a dissolve. The scene's own entrance is longer than this,
  // which is what makes the two overlap instead of queue.
  const FADE = 0.46;

  // ── Scene dispatch ──────────────────────────────────────────────────────
  scenes.forEach((scene, idx) => {
    const start = parseFloat(scene.dataset.start);
    const dur   = parseFloat(scene.dataset.duration);
    const layout = scene.dataset.layout;
    const isLast = idx === scenes.length - 1;

    // ── Scene enter / exit ────────────────────────────────────────────────
    // Enter and exit are now a matched PAIR per scene, and consecutive scenes
    // alternate direction, so the video has a sense of travel instead of every
    // cut being the same push. Before, every scene left identically
    // (scale 0.94 + fade) no matter how it arrived.
    const ENTER_DUR = 0.62;
    const dir = idx % 2 === 0 ? 1 : -1;   // alternate the drift axis per scene

    // The FIRST scene is a special case: it must never fade up from nothing.
    // Its `start` is the pipeline's voice lead-in (~0.35s), so a normal
    // opacity-0 entrance leaves the opening frames of the mp4 completely blank —
    // measured 3.8 luma-stddev at t=0 vs ~45 by t=0.3 on every delivered video.
    // A blank opening frame is also what the platform grabs for an auto cover.
    // So: the scene is on screen from frame 0, and its reveal is re-based to 0 so
    // the entrance plays THROUGH the lead-in and has settled by the first word.
    const isFirst = idx === 0;
    const enterStart = isFirst ? 0 : start;

    if (isFirst) {
      gsap.set(scene, { opacity: 1 });
      tl.fromTo(scene, { scale: 1.05 }, { scale: 1, duration: Math.max(0.66, start + 0.5), ease: EASE.settle }, 0);
    } else if (layout === 'hook') {
      tl.fromTo(scene, { opacity: 0, scale: 1.07 }, { opacity: 1, scale: 1, duration: 0.66, ease: EASE.settle }, start);
    } else if (layout === 'stat-hero' || layout === 'callout' || layout === 'feature-list') {
      tl.fromTo(scene, { opacity: 0, y: 42 * dir, scale: 0.985 },
                       { opacity: 1, y: 0, scale: 1, duration: ENTER_DUR, ease: EASE.settle }, start);
    } else if (layout === 'big-quote') {
      tl.fromTo(scene, { opacity: 0, scale: 1.09 }, { opacity: 1, scale: 1, duration: 0.66, ease: EASE.settle }, start);
    } else if (layout === 'engagement-question') {
      tl.fromTo(scene, { opacity: 0, scale: 0.93 }, { opacity: 1, scale: 1, duration: 0.62, ease: EASE.nudge }, start);
    } else if (layout === 'outro') {
      tl.fromTo(scene, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.70, ease: EASE.settle }, start);
    } else if (layout === 'group-intro' || layout === 'match-results' || layout === 'bracket' || layout === 'tactics-board' || layout === 'form-compare') {
      tl.fromTo(scene, { opacity: 0, y: 42 * dir, scale: 0.985 },
                       { opacity: 1, y: 0, scale: 1, duration: ENTER_DUR, ease: EASE.settle }, start);
    } else {
      tl.fromTo(scene, { opacity: 0, y: 26 * dir }, { opacity: 1, y: 0, duration: ENTER_DUR, ease: EASE.settle }, start);
    }

    // Whole-scene parallax: a slow counter-drift for the scene's entire life,
    // laid on AFTER the entrance so it inherits the settled position. This is
    // what stops a scene from freezing dead once its entrance finishes — the
    // single biggest reason the old cut felt static between beats.
    if (layout !== 'hook') {
      drift(tl, scene, { y: 0 }, { y: -10 * dir }, start + ENTER_DUR, Math.max(0.6, dur - ENTER_DUR));
    }

    // Exit — accelerating, and it LEAVES the way the next scene arrives.
    const fadeOutStart = isLast ? Math.max(start + 0.01, start + dur - FADE) : start + dur;
    if (!isLast) {
      tl.to(scene, { opacity: 0, scale: 0.955, y: -34 * dir, duration: FADE + 0.14, ease: EASE.exit }, fadeOutStart);
    } else {
      tl.to(scene, { opacity: 0, scale: 0.97, duration: FADE, ease: EASE.exit }, fadeOutStart);
    }

    // The framed photo is the biggest object on any body scene and until now
    // had NO motion of its own — it just appeared with the scene fade while
    // the text under it animated. Give it a proper arrival plus a slow
    // push-in that runs the whole scene.
    animatePhotoCard(scene, tl, enterStart, dur);

    if (layout === "hook") {
      animateHook(scene, tl, enterStart);
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
    } else if (layout === "bracket") {
      animateBracket(scene, tl, start);
    } else if (layout === "tactics-board") {
      animateTacticsBoard(scene, tl, start);
    } else if (layout === "form-compare") {
      animateFormCompare(scene, tl, start);
    } else if (layout === "engagement-question") {
      animateEngagementQuestion(scene, tl, start);
    } else if (layout === "outro") {
      animateOutro(scene, tl, start, dur);
    }
  });

  // ── FX shader-transition curtains (glitch accents) ───────────────────────
  // Data-driven by window.__FX_TRANSITIONS (emitted by html-composer.ts). Each
  // entry is a full-frame WebGL curtain centered on a scene boundary, driven by
  // an onUpdate tween on the seekable timeline (same idiom as animateCounter).
  // No-op when there are no transitions or WebGL is unavailable → CSS crossfade.
  const fxCanvas = document.getElementById("fx-transition");
  const fxCfg = window.__FX_TRANSITIONS || [];
  if (fxCanvas && fxCfg.length && window.__fxTransition) {
    gsap.set(fxCanvas, { opacity: 0 });
    fxCfg.forEach((c, idx) => {
      const dur = c.dur || 0.68;
      const at = c.at - dur / 2;            // center the curtain on the boundary
      const fx = { p: 0 };
      tl.to(fxCanvas, { opacity: 1, duration: 0.10, ease: "power1.out" }, at);
      tl.to(fx, { p: 1, duration: dur, ease: "power2.inOut",
        onUpdate: () => window.__fxTransition.draw(idx, fx.p) }, at);
      tl.to(fxCanvas, { opacity: 0, duration: 0.10, ease: "power1.in" }, at + dur - 0.06);
    });
  }

  // ── Framed photo card ───────────────────────────────────────────────────
  /**
   * Arrival + life for `.bg-card` (stat-hero / callout) and `.feat-hero`
   * (feature-list).
   *
   * Two separate moves on purpose, and they must not fight:
   *   - the CARD (the white-matted frame) rises and settles once;
   *   - the IMAGE INSIDE it pushes in slowly for the whole scene.
   * Animating both on the same element would mean the settle overshoot also
   * scales the photo, which reads as a wobble.
   *
   * The push-in used to be a CSS @keyframes (`kb-card-zoom`, fixed 8s). That
   * ran on the wall clock, so it did not line up with a seeked render and did
   * not match the scene's real length either — an 11s scene froze for the last
   * 3s, a 6s scene got cut off mid-move. On the timeline it is exactly as long
   * as the scene.
   */
  function animatePhotoCard(scene, tl, start, dur) {
    const card = scene.querySelector(".bg-card, .feat-hero");
    if (!card) return;

    tl.fromTo(
      card,
      { opacity: 0, y: 38, scale: 0.965 },
      { opacity: 1, y: 0, scale: 1, duration: 0.72, ease: EASE.settle },
      start + 0.06,
    );

    const img = card.querySelector(".bg-card-img, .feat-hero-img");
    // 1.0 → 1.07 across the scene. Small on purpose: the card is clipped
    // (`overflow:hidden`), so a bigger push starts cropping the subject.
    drift(tl, img, { scale: 1.0 }, { scale: 1.07 }, start, Math.max(1.2, dur));
  }

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
      const note = scene.querySelector(".cs-note");
      if (note) tl.fromTo(note, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: EASE.slide }, start + 0.95);
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

    // 2. Value — the heaviest piece of type on the frame, so it SETTLES rather
    //    than boings. It used to run scale 0.3 → 1 on back.out(2.5): a 140px
    //    display face swinging through a 3.3× scale change, which at this size
    //    reads as rubber, not as impact. A short travel on a long curve, plus a
    //    single tightening beat after it lands, gives the weight without the
    //    wobble.
    const value = scene.querySelector(".stat-value");
    const hasCounter = value && value.dataset.counterTo;
    if (value) {
      tl.fromTo(
        value,
        { scale: 0.86, opacity: 0, y: 22 },
        { scale: 1, opacity: 1, y: 0, duration: 0.78, ease: EASE.settle },
        start + 0.28
      );
      // Emphasis beat — 3% and back. Reads as a breath on the number.
      tl.to(value, { scale: 1.03, duration: 0.16, ease: "sine.out" }, start + 1.02);
      tl.to(value, { scale: 1.0,  duration: 0.30, ease: "sine.inOut" }, start + 1.18);
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

    // 6. Highlights — small objects, so these DO get the springy curve, and
    //    they come in from the left so the eye reads them as a list forming
    //    rather than three things popping in place. Dots lead their own text
    //    by a hair, which is what makes a stagger feel hand-made.
    const highlights = scene.querySelectorAll(".stat-highlight");
    highlights.forEach((h, i) => {
      const at = start + 1.32 + i * 0.13;
      tl.fromTo(
        h,
        { x: -26, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, ease: EASE.settle },
        at
      );
      const dot = h.querySelector(".stat-highlight-dot");
      if (dot) {
        tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.42, ease: EASE.spring }, at + 0.05);
      }
    });

    // 7. Parallax on the text column — drifts UP slightly slower than the
    //    scene itself for the rest of the shot, so photo and type sit on
    //    different planes instead of moving as one flat sheet.
    const col = scene.querySelector(".stat-hero-content");
    drift(tl, col, { y: 0 }, { y: -14 }, start + 1.6, 6.0);
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

  function animateBracket(scene, tl, start) {
    const title = scene.querySelector(".brk-title");
    if (title) tl.fromTo(title, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: EASE.slide }, start);
    const sub = scene.querySelector(".brk-sub");
    if (sub) tl.fromTo(sub, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: EASE.drawIn }, start + 0.15);
    const badge = scene.querySelector(".brk-badge");
    if (badge) tl.fromTo(badge, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, start + 0.25);
    const lefts = scene.querySelectorAll(".brk-col-l .brk-match");
    lefts.forEach((m, i) => tl.fromTo(m, { x: -50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: EASE.pop }, start + 0.35 + i * 0.11));
    const rights = scene.querySelectorAll(".brk-col-r .brk-match");
    rights.forEach((m, i) => tl.fromTo(m, { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: EASE.pop }, start + 0.4 + i * 0.11));
  }

  function animateTacticsBoard(scene, tl, start) {
    const eb = scene.querySelector(".tac-eyebrow");
    if (eb) tl.fromTo(eb, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: EASE.drawIn }, start + 0.08);
    const title = scene.querySelector(".tac-title");
    if (title) tl.fromTo(title, { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: EASE.slide }, start + 0.18);
    const rule = scene.querySelector(".tac-rule");
    if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: EASE.drawIn }, start + 0.36);
    const vs = scene.querySelector(".tac-vs");
    if (vs) tl.fromTo(vs, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, start + 0.32);
    // Two columns slide in from their sides, then their bullets stagger.
    ["l", "r"].forEach((which, ci) => {
      const col = scene.querySelector(".tac-col-" + which);
      if (!col) return;
      const dir = which === "l" ? -60 : 60;
      tl.fromTo(col, { x: dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "back.out(1.3)" }, start + 0.42 + ci * 0.1);
      const pts = col.querySelectorAll(".tac-point");
      pts.forEach((p, i) => {
        tl.fromTo(p, { x: dir * 0.35, opacity: 0 }, { x: 0, opacity: 1, duration: 0.34, ease: EASE.slide }, start + 0.75 + ci * 0.1 + i * 0.1);
      });
      const key = col.querySelector(".tac-key");
      if (key) tl.fromTo(key, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: EASE.pop }, start + 0.95 + ci * 0.1 + pts.length * 0.1);
    });
  }

  function animateFormCompare(scene, tl, start) {
    const eb = scene.querySelector(".fc-eyebrow");
    if (eb) tl.fromTo(eb, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: EASE.drawIn }, start + 0.08);
    const title = scene.querySelector(".fc-title");
    if (title) tl.fromTo(title, { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: EASE.slide }, start + 0.18);
    const rule = scene.querySelector(".fc-rule");
    if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: EASE.drawIn }, start + 0.36);
    const vs = scene.querySelector(".fc-vs");
    if (vs) tl.fromTo(vs, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, start + 0.32);
    // Two columns slide in from their sides, then their result rows stagger.
    ["l", "r"].forEach((which, ci) => {
      const col = scene.querySelector(".fc-col-" + which);
      if (!col) return;
      const dir = which === "l" ? -60 : 60;
      tl.fromTo(col, { x: dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "back.out(1.3)" }, start + 0.42 + ci * 0.1);
      const rows = col.querySelectorAll(".fc-row");
      rows.forEach((r, i) => {
        tl.fromTo(r, { x: dir * 0.35, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, ease: EASE.slide }, start + 0.72 + ci * 0.1 + i * 0.09);
      });
    });
  }

  function animateFeatureList(scene, tl, start) {
    // (The hero image is handled by animatePhotoCard — shared with stat-hero
    // and callout so all three photo frames arrive identically.)

    // Header eyebrow stroke — draws left-to-right.
    const eyebrow = scene.querySelector(".feat-eyebrow");
    if (eyebrow) {
      tl.fromTo(eyebrow, { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: EASE.drawIn }, start + 0.12);
    }
    // Title
    const title = scene.querySelector(".feat-title");
    if (title) {
      tl.fromTo(title, { y: -22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: EASE.settle }, start + 0.26);
    }
    // Cards — the stagger now moves in TWO dimensions: each card comes from
    // slightly further right than the one above it, so the group lands as a
    // fan rather than a rigid column. The tick node pops after its card
    // settles, which gives each row a second, smaller beat.
    const cards = scene.querySelectorAll(".feat-card");
    cards.forEach((card, i) => {
      const at = start + 0.56 + i * 0.15;
      tl.fromTo(
        card,
        { x: 56 + i * 14, opacity: 0, scale: 0.965 },
        { x: 0, opacity: 1, scale: 1, duration: 0.62, ease: EASE.settle },
        at
      );
      const node = card.querySelector(".feat-node");
      if (node) {
        tl.fromTo(node, { scale: 0 }, { scale: 1, duration: 0.44, ease: EASE.spring }, at + 0.22);
      }
    });

    // Slow parallax on the list for the rest of the scene.
    drift(tl, scene.querySelector(".feat-cards"), { y: 0 }, { y: -12 }, start + 1.5, 6.0);
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

    // 3. Tag pill — small, so it springs.
    const tag = scene.querySelector(".callout-tag");
    if (tag) {
      tl.fromTo(
        tag,
        { scale: 0.82, opacity: 0, y: 14 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: EASE.spring },
        start + 0.22
      );
    }

    // 4. Statement word-by-word reveal.
    animateWords(scene, ".callout-statement .co-word", start + 0.52, 0.055, 0.34);

    // (The quote marks are ::before/::after on .callout-statement, so GSAP
    // cannot target them directly and they simply ride the content fade. Not
    // worth a wrapper element just to stagger two glyphs.)

    // 5. Parallax on the text column, same idea as stat-hero.
    drift(tl, scene.querySelector(".callout-content"), { y: 0 }, { y: -12 }, start + 1.3, 6.0);
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
