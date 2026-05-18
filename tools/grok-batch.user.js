// ==UserScript==
// @name         SportsForAllTV — Grok Imagine batch helper
// @namespace    https://github.com/auto-create-video/bonglan
// @version      0.1.0
// @description  Load images-plan.json on grok.com, paste prompts with one click, auto-rename downloads to <sceneId>.<ext>. Quality control still in your hands — pick best variant + click download as usual.
// @match        https://grok.com/*
// @match        https://*.grok.com/*
// @match        https://x.com/i/grok*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

/* eslint-disable no-undef */
(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────

  const STORAGE_KEY_PLAN = "bonglan-plan-v1";
  const STORAGE_KEY_DONE = "bonglan-done-v1"; // sceneId → true
  const PANEL_ID = "bonglan-grok-panel";
  // MutationObserver image filter — ignore icons / avatars / favicons.
  const MIN_IMG_WIDTH = 320;
  const MIN_IMG_HEIGHT = 320;

  /** Selector candidates for the Grok prompt input — first match wins. */
  const INPUT_SELECTORS = [
    // Grok 2026 — ProseMirror / Tiptap rich-text editor (the live UI).
    'div.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"].ProseMirror',
    // Legacy textarea fallbacks (older Grok variants, or other AI sites).
    'textarea[placeholder*="Imagine" i]',
    'textarea[placeholder*="generate" i]',
    'textarea[placeholder*="describe" i]',
    '[contenteditable="true"][role="textbox"]',
    'textarea[aria-label*="prompt" i]',
  ];

  // ── State ─────────────────────────────────────────────────────────────────

  /** @type {{ version: string, source: string, contentType: string, title: string, scenes: Array<{ id: string, template: string, filename: string, subjectHint?: string, prompt: string }> } | null} */
  let plan = null;
  /** @type {Set<string>} sceneIds marked as done */
  const done = new Set();
  /** @type {string | null} currently active sceneId — the next image saved gets this id's filename */
  let activeSceneId = null;
  /** @type {FileSystemDirectoryHandle | null} optional input folder for direct write */
  let folderHandle = null;
  let folderHandleName = "";

  // ── Storage helpers ───────────────────────────────────────────────────────

  function loadPersisted() {
    try {
      const rawPlan = GM_getValue(STORAGE_KEY_PLAN, null);
      if (rawPlan) plan = JSON.parse(rawPlan);
      const rawDone = GM_getValue(STORAGE_KEY_DONE, null);
      if (rawDone) {
        const arr = JSON.parse(rawDone);
        if (Array.isArray(arr)) for (const id of arr) done.add(id);
      }
    } catch (e) {
      console.warn("[bonglan] failed to load persisted state", e);
    }
  }

  function persist() {
    try {
      GM_setValue(STORAGE_KEY_PLAN, plan ? JSON.stringify(plan) : null);
      GM_setValue(STORAGE_KEY_DONE, JSON.stringify([...done]));
    } catch (e) {
      console.warn("[bonglan] failed to persist", e);
    }
  }

  // ── Plan loading ──────────────────────────────────────────────────────────

  function validatePlanShape(p) {
    if (!p || typeof p !== "object") return "not an object";
    if (!Array.isArray(p.scenes) || p.scenes.length === 0) return "missing scenes[]";
    for (const s of p.scenes) {
      if (!s.id || !s.filename || !s.prompt) return `scene ${s.id ?? "?"} missing id/filename/prompt`;
    }
    return null;
  }

  async function pickPlanFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    return new Promise((resolve) => {
      input.addEventListener("change", () => {
        const f = input.files?.[0];
        if (!f) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result));
            const err = validatePlanShape(parsed);
            if (err) {
              alert("Plan không hợp lệ: " + err);
              return resolve(null);
            }
            resolve(parsed);
          } catch (e) {
            alert("JSON parse lỗi: " + e.message);
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(f);
      });
      input.click();
    });
  }

  // ── Folder picker (File System Access API, optional) ──────────────────────

  async function pickFolder() {
    if (typeof window.showDirectoryPicker !== "function") {
      alert(
        "Trình duyệt không hỗ trợ File System Access API. Ảnh sẽ về Downloads/ — anh tự move qua input/<slug>/.",
      );
      return null;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      folderHandle = handle;
      folderHandleName = handle.name;
      return handle;
    } catch (e) {
      // User cancelled — silent.
      if (e?.name !== "AbortError") console.warn("[bonglan] folder pick failed", e);
      return null;
    }
  }

  // ── Prompt paste into Grok input ──────────────────────────────────────────

  function findGrokInput() {
    // 1. Try the curated selector list (ProseMirror first, textarea fallback).
    for (const sel of INPUT_SELECTORS) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return el;
      } catch { /* selector unsupported in this browser — skip */ }
    }
    // 2. Last-resort: find any element carrying a placeholder hint, walk up to
    //    its contenteditable wrapper. Grok puts data-placeholder on an inner
    //    <p>, so the editable container is its closest ancestor.
    const hint = document.querySelector(
      '[data-placeholder*="imagine" i], [placeholder*="imagine" i], ' +
      '[data-placeholder*="generate" i], [placeholder*="generate" i]',
    );
    if (hint) {
      const editable = hint.closest('[contenteditable="true"]');
      if (editable && isVisible(editable)) return editable;
    }
    return null;
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /**
   * Set input value in a way React's controlled-input listener picks up.
   * Plain `.value = ...` doesn't trigger React's onChange.
   */
  function setReactInputValue(el, text) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter?.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (el.isContentEditable) {
      el.focus();
      // Clear existing content
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("delete", false);
      document.execCommand("insertText", false, text);
    }
  }

  function pastePrompt(prompt) {
    const el = findGrokInput();
    if (!el) {
      alert(
        "Không tìm được ô prompt của Grok. Anh check selector trong userscript (INPUT_SELECTORS) — Grok có thể đã đổi DOM.",
      );
      return false;
    }
    el.focus();
    setReactInputValue(el, prompt);
    return true;
  }

  // ── Image download with auto-rename ───────────────────────────────────────

  /** Convert Blob to Uint8Array for FileSystemWritable. */
  async function blobToBuffer(blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }

  function extFromMime(mime) {
    if (!mime) return "jpg";
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
    return "jpg";
  }

  function extFromUrl(url) {
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\.(png|jpe?g|webp)(?:$|\?)/i);
      return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
    } catch {
      return null;
    }
  }

  async function fetchImageBlob(src) {
    // Same-origin / blob: URLs work via fetch directly.
    const resp = await fetch(src, { credentials: "include", mode: "cors" });
    if (!resp.ok) throw new Error(`fetch ${src} → ${resp.status}`);
    return await resp.blob();
  }

  /** Trigger a download with a chosen filename. Works for cross-origin via blob roundtrip. */
  async function downloadAs(src, filename) {
    const blob = await fetchImageBlob(src);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /** Write image directly into the picked input folder, bypassing Downloads/. */
  async function writeToFolder(src, filename) {
    if (!folderHandle) throw new Error("no folder picked");
    // Re-verify permission (Chrome may have downgraded to "prompt").
    const perm = await folderHandle.queryPermission?.({ mode: "readwrite" });
    if (perm !== "granted") {
      const req = await folderHandle.requestPermission?.({ mode: "readwrite" });
      if (req !== "granted") throw new Error("folder permission denied");
    }
    const blob = await fetchImageBlob(src);
    const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(await blobToBuffer(blob));
    await writable.close();
  }

  /** Save the given image src under the active scene's filename, using folderHandle if available. */
  async function saveImageForActiveScene(src) {
    if (!activeSceneId || !plan) {
      alert("Chưa chọn scene nào. Bấm Paste vào 1 scene trong panel trước.");
      return;
    }
    const scene = plan.scenes.find((s) => s.id === activeSceneId);
    if (!scene) return;
    const baseStem = scene.filename.replace(/\.[a-z]+$/i, "");
    const ext = extFromUrl(src) || extFromMime((await fetchImageBlob(src)).type) || "jpg";
    const filename = `${baseStem}.${ext}`;
    try {
      if (folderHandle) {
        await writeToFolder(src, filename);
        toast(`✓ Saved ${filename} → ${folderHandleName}/`);
      } else {
        await downloadAs(src, filename);
        toast(`↓ Downloaded ${filename}`);
      }
      done.add(scene.id);
      persist();
      renderPanel();
    } catch (e) {
      console.error("[bonglan] save failed", e);
      alert("Save lỗi: " + e.message);
    }
  }

  // ── DOM observer: attach Save buttons to new <img> ────────────────────────

  /** WeakSet of imgs already decorated with our overlay button. */
  const decorated = new WeakSet();

  function isCandidateImage(img) {
    if (!(img instanceof HTMLImageElement)) return false;
    if (decorated.has(img)) return false;
    if (!img.src || img.src.startsWith("data:image/svg")) return false;
    // Wait for natural dimensions to be available.
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w && h && (w < MIN_IMG_WIDTH || h < MIN_IMG_HEIGHT)) return false;
    // Heuristic: skip avatars / icons by checking aspect ratio is portrait-ish or square (Grok 9:16 outputs).
    return true;
  }

  function attachSaveOverlay(img) {
    if (decorated.has(img)) return;
    decorated.add(img);

    const wrap = document.createElement("div");
    wrap.className = "bonglan-save-wrap";
    wrap.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 9999;
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "↓ Save as scene";
    btn.className = "bonglan-save-btn";
    btn.style.cssText = `
      pointer-events: auto;
      background: rgba(0, 200, 255, 0.95);
      color: #0a0a0a;
      border: none;
      border-radius: 6px;
      padding: 6px 10px;
      font: 600 12px/1 system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    `;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      saveImageForActiveScene(img.currentSrc || img.src);
    });
    wrap.appendChild(btn);

    function position() {
      const r = img.getBoundingClientRect();
      wrap.style.top = window.scrollY + r.top + 8 + "px";
      wrap.style.left = window.scrollX + r.left + 8 + "px";
      btn.textContent = activeSceneId
        ? `↓ Save as ${activeSceneFilename()}`
        : "↓ Pick a scene first";
    }
    position();

    document.body.appendChild(wrap);
    // Reposition on scroll/resize. Cheap throttle via rAF.
    let rafId = 0;
    const onMove = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(position);
    };
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);

    // Cleanup if img leaves DOM.
    const cleanupObs = new MutationObserver(() => {
      if (!document.body.contains(img)) {
        wrap.remove();
        window.removeEventListener("scroll", onMove);
        window.removeEventListener("resize", onMove);
        cleanupObs.disconnect();
      }
    });
    cleanupObs.observe(document.body, { childList: true, subtree: true });
  }

  function activeSceneFilename() {
    if (!plan || !activeSceneId) return "";
    const s = plan.scenes.find((s) => s.id === activeSceneId);
    return s ? s.filename : "";
  }

  function scanAllImages() {
    for (const img of document.querySelectorAll("img")) {
      if (img.complete && img.naturalWidth) {
        if (isCandidateImage(img)) attachSaveOverlay(img);
      } else {
        img.addEventListener(
          "load",
          () => {
            if (isCandidateImage(img)) attachSaveOverlay(img);
          },
          { once: true },
        );
      }
    }
  }

  function startImageObserver() {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLImageElement) {
            if (isCandidateImage(node)) attachSaveOverlay(node);
            else node.addEventListener("load", () => {
              if (isCandidateImage(node)) attachSaveOverlay(node);
            }, { once: true });
          } else if (node instanceof HTMLElement) {
            for (const img of node.querySelectorAll?.("img") ?? []) {
              if (isCandidateImage(img)) attachSaveOverlay(img);
              else img.addEventListener("load", () => {
                if (isCandidateImage(img)) attachSaveOverlay(img);
              }, { once: true });
            }
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    scanAllImages();
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function toast(msg, ms = 2500) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(20, 20, 30, 0.95);
      color: #fff;
      padding: 10px 16px;
      border-radius: 8px;
      font: 500 14px system-ui, sans-serif;
      z-index: 999999;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ── Panel UI (shadow DOM to avoid CSS clash) ──────────────────────────────

  /** @type {HTMLElement | null} */
  let panelHost = null;
  /** @type {ShadowRoot | null} */
  let panelRoot = null;

  function ensurePanel() {
    if (panelHost) return;
    panelHost = document.createElement("div");
    panelHost.id = PANEL_ID;
    panelHost.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 999999;
      width: 380px;
      max-height: calc(100vh - 32px);
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    `;
    panelRoot = panelHost.attachShadow({ mode: "open" });
    panelRoot.innerHTML = `
      <style>
        :host { all: initial; }
        .panel {
          background: #1a1d23;
          color: #e7e9ee;
          border: 1px solid #2a2e36;
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.45);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: calc(100vh - 32px);
        }
        .header {
          padding: 12px 14px;
          border-bottom: 1px solid #2a2e36;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .title {
          font-size: 13px;
          font-weight: 600;
          color: #00d4ff;
          flex: 1;
          letter-spacing: 0.02em;
        }
        .iconbtn {
          background: transparent;
          color: #9aa0aa;
          border: none;
          font-size: 14px;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
        }
        .iconbtn:hover { background: #2a2e36; color: #fff; }
        .controls {
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-bottom: 1px solid #2a2e36;
        }
        .row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .btn {
          background: #2a2e36;
          color: #e7e9ee;
          border: 1px solid #3a3f47;
          border-radius: 6px;
          padding: 6px 10px;
          font: 500 12px system-ui, sans-serif;
          cursor: pointer;
          flex: 1;
        }
        .btn:hover { background: #3a3f47; }
        .btn.primary {
          background: #0099cc;
          color: #0a0a0a;
          border-color: #0099cc;
          font-weight: 600;
        }
        .btn.primary:hover { background: #00bbee; border-color: #00bbee; }
        .meta {
          font-size: 11px;
          color: #8a909a;
        }
        .meta b { color: #c5c8cf; font-weight: 500; }
        .scenes {
          overflow-y: auto;
          flex: 1;
          padding: 4px 0;
        }
        .scene {
          padding: 10px 14px;
          border-bottom: 1px solid #232730;
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .scene:hover { background: #20242c; }
        .scene.active { background: #1a2a30; border-left: 3px solid #00d4ff; padding-left: 11px; }
        .scene.done .stem { color: #6ad26a; }
        .scene.done .stem::before { content: "✓ "; }
        .scene-num {
          font: 600 11px system-ui;
          color: #5a606a;
          width: 18px;
          flex-shrink: 0;
          padding-top: 1px;
        }
        .scene-body { flex: 1; min-width: 0; }
        .stem {
          font: 600 12px system-ui;
          color: #c5c8cf;
          margin-bottom: 2px;
        }
        .hint {
          font-size: 11px;
          color: #8a909a;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .scene-actions {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex-shrink: 0;
        }
        .smallbtn {
          background: #2a2e36;
          color: #e7e9ee;
          border: 1px solid #3a3f47;
          border-radius: 4px;
          padding: 3px 7px;
          font: 500 11px system-ui;
          cursor: pointer;
        }
        .smallbtn:hover { background: #3a3f47; }
        .empty {
          padding: 24px 14px;
          color: #8a909a;
          font-size: 12px;
          text-align: center;
          line-height: 1.5;
        }
        .footer {
          padding: 8px 14px;
          border-top: 1px solid #2a2e36;
          font-size: 11px;
          color: #6a707a;
          line-height: 1.4;
        }
      </style>
      <div class="panel">
        <div class="header">
          <div class="title">SportsForAllTV — Grok batch</div>
          <button class="iconbtn" id="collapseBtn" title="Thu/mở">−</button>
        </div>
        <div class="controls" id="controls">
          <div class="row">
            <button class="btn primary" id="loadBtn">Load plan</button>
            <button class="btn" id="folderBtn">Pick folder</button>
          </div>
          <div class="meta" id="metaLine">Chưa load plan.</div>
        </div>
        <div class="scenes" id="scenes"></div>
        <div class="footer" id="footer">
          Click 1 scene → prompt được paste vào Grok. Bấm Imagine, chọn variant.
          Hover qua ảnh để hiện nút <b>Save as &lt;file&gt;</b>.
        </div>
      </div>
    `;
    document.documentElement.appendChild(panelHost);

    panelRoot.getElementById("loadBtn").addEventListener("click", async () => {
      const p = await pickPlanFile();
      if (p) {
        plan = p;
        // Reset done state when loading a new plan with different scenes.
        const newIds = new Set(p.scenes.map((s) => s.id));
        for (const id of [...done]) if (!newIds.has(id)) done.delete(id);
        activeSceneId = null;
        persist();
        renderPanel();
        toast(`✓ Loaded ${p.scenes.length} scenes`);
      }
    });
    panelRoot.getElementById("folderBtn").addEventListener("click", async () => {
      const h = await pickFolder();
      if (h) {
        toast(`✓ Folder: ${h.name}`);
        renderPanel();
      }
    });
    panelRoot.getElementById("collapseBtn").addEventListener("click", () => {
      const ctrl = panelRoot.getElementById("controls");
      const scenes = panelRoot.getElementById("scenes");
      const foot = panelRoot.getElementById("footer");
      const collapsed = ctrl.style.display === "none";
      const next = collapsed ? "" : "none";
      ctrl.style.display = next;
      scenes.style.display = next;
      foot.style.display = next;
      panelRoot.getElementById("collapseBtn").textContent = collapsed ? "−" : "+";
    });
  }

  function renderPanel() {
    if (!panelRoot) return;
    const meta = panelRoot.getElementById("metaLine");
    const list = panelRoot.getElementById("scenes");

    if (!plan) {
      meta.innerHTML = "Chưa load plan.";
      list.innerHTML = `<div class="empty">Bấm <b>Load plan</b> rồi chọn <code>images-plan.json</code> trong <code>input/&lt;slug&gt;/</code>.</div>`;
      return;
    }

    const total = plan.scenes.length;
    const ok = plan.scenes.filter((s) => done.has(s.id)).length;
    const folderLine = folderHandle
      ? `<b>Folder:</b> ${folderHandleName} — ảnh sẽ ghi thẳng vào folder.`
      : `<b>Folder:</b> chưa chọn — ảnh sẽ về Downloads/, anh tự move.`;
    meta.innerHTML = `<b>${plan.title || plan.source}</b><br><b>${ok}/${total}</b> scene xong · ${folderLine}`;

    list.innerHTML = "";
    plan.scenes.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "scene" + (s.id === activeSceneId ? " active" : "") + (done.has(s.id) ? " done" : "");
      row.innerHTML = `
        <div class="scene-num">${i + 1}</div>
        <div class="scene-body">
          <div class="stem">${escapeHtml(s.filename)}</div>
          <div class="hint">${escapeHtml(s.subjectHint || s.id)}</div>
        </div>
        <div class="scene-actions">
          <button class="smallbtn" data-act="paste" data-id="${s.id}">Paste</button>
          <button class="smallbtn" data-act="copy"  data-id="${s.id}">Copy</button>
        </div>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        const scene = plan.scenes.find((s) => s.id === id);
        if (!scene) return;
        if (act === "paste") {
          if (pastePrompt(scene.prompt)) {
            activeSceneId = id;
            renderPanel();
            toast(`Pasted: ${scene.filename} — bấm Imagine trên Grok`);
          }
        } else if (act === "copy") {
          navigator.clipboard.writeText(scene.prompt).then(
            () => toast(`Copied prompt for ${scene.filename}`),
            () => toast("Clipboard write lỗi"),
          );
        }
      });
    });

    list.querySelectorAll(".scene").forEach((row, i) => {
      row.addEventListener("click", () => {
        const s = plan.scenes[i];
        activeSceneId = s.id;
        renderPanel();
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
    );
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  loadPersisted();
  ensurePanel();
  renderPanel();
  startImageObserver();

  console.log("[bonglan] Grok batch helper ready. Plan loaded:", !!plan);
})();
