// Pre-flight validate script.json before burning TTS quota.
// Two gates: (1) ScriptSchema (zod field caps), (2) PACING — nhịp.
// PHẢI nằm ở repo root: tsx resolve import tương đối theo vị trí file .ts, không theo cwd.
import { readFileSync } from "node:fs";
import { ScriptSchema } from "./src/render/script-schema";

// ─── Ngân sách nhịp ────────────────────────────────────────────────────────
// Đo thật trên 27 video 9:16 đã render: 0,256 s/từ (median), 0,277 (worst case)
// — đã gồm khoảng lặng giữa câu + SCENE_GAP_SEC. Trần 170 từ ⇒ ≤47s kể cả
// worst case. Lý do siết (2026-08-19): video cũ giữ 1 hình tĩnh 8–12 giây,
// mọi video kẹt ở 200–300 view = trượt rổ test đầu của TikTok.
// Xem memory/feedback_scene_pacing_four_second_cap.md
const SEC_PER_WORD = 0.26;

const BUDGET = {
  "9:16": {
    totalWords: 170,
    scenesMin: 6,
    scenesMax: 13, // 11 thường; 12–13 chỉ cho listicle "N mục" phải đủ mục
    wordsPerScene: 16,
    hookWords: 12,
    targetSec: 45,
  },
  "16:9": {
    // Bản tin YouTube — KHÔNG áp luật nhịp short, đây chỉ là lưới an toàn.
    // Trần per-scene lấy từ 7 bản tin đã giao (max thật: hook 46, body 84)
    // rồi nới lên — mục đích là chặn scene phình bất thường, không phải
    // ép lại một định dạng đang chạy đúng.
    totalWords: 1250,
    scenesMin: 8,
    scenesMax: 24,
    wordsPerScene: 90,
    hookWords: 55,
    targetSec: 360,
  },
} as const;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Bag of significant words, lowercased and stripped of the noise that differs
 * between a written headline and a spoken line (punctuation, the `|` line break,
 * and the club-name expansions voiceText is required to spell out in full).
 */
const CANON: Array<[RegExp, string]> = [
  [/manchester united|man utd|quỷ đỏ/g, "manutd"],
  [/manchester city|man city/g, "mancity"],
  [/real madrid/g, "real"],
  [/barcelona|barca/g, "barca"],
  [/paris saint-germain|psg/g, "psg"],
];
const bag = (s: string): Set<string> => {
  let t = s.toLowerCase().replace(/\|/g, " ");
  for (const [re, to] of CANON) t = t.replace(re, to);
  return new Set(
    t
      .replace(/[.,!?;:"'“”‘’()\-–—]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
};
/** Share of the headline's words that the spoken line also says. */
const overlapRatio = (headline: string, voiceFirstSentence: string): number => {
  const h = bag(headline);
  if (h.size === 0) return 0;
  const v = bag(voiceFirstSentence);
  let hit = 0;
  for (const w of h) if (v.has(w)) hit++;
  return hit / h.size;
};

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: npx tsx _validate-script.ts <script.json> [...]");
  process.exit(2);
}

let failed = false;
for (const file of files) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    failed = true;
    console.log(`FAIL ${file}\n  invalid JSON: ${(err as Error).message}`);
    continue;
  }

  const res = ScriptSchema.safeParse(parsed);
  if (!res.success) {
    failed = true;
    console.log(`FAIL ${file}  (schema)`);
    for (const issue of res.error.issues) {
      console.log(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    continue; // pacing gate cần script hợp lệ mới đo được
  }

  const script = res.data;
  const aspect = script.metadata.aspect === "16:9" ? "16:9" : "9:16";
  const b = BUDGET[aspect];

  const errors: string[] = [];
  const warns: string[] = [];

  const perScene = script.scenes.map((s) => ({
    id: s.id,
    template: s.templateData.template,
    w: words(s.voiceText ?? ""),
  }));
  const total = perScene.reduce((a, s) => a + s.w, 0);
  const est = total * SEC_PER_WORD;

  if (total > b.totalWords) {
    errors.push(
      `tổng voiceText ${total} từ > trần ${b.totalWords} (~${est.toFixed(0)}s, mục tiêu ≤${b.targetSec}s) — cắt câu, ĐỪNG bỏ scene`,
    );
  }
  if (script.scenes.length > b.scenesMax) {
    errors.push(`${script.scenes.length} scene > trần ${b.scenesMax}`);
  }
  if (script.scenes.length < b.scenesMin) {
    errors.push(`${script.scenes.length} scene < sàn ${b.scenesMin}`);
  }

  for (const s of perScene) {
    const cap = s.template === "hook" ? b.hookWords : b.wordsPerScene;
    if (s.w > cap) {
      const held = (s.w * SEC_PER_WORD).toFixed(1);
      errors.push(
        aspect === "9:16"
          ? `scene "${s.id}" (${s.template}): ${s.w} từ > ${cap} — ~${held}s trên MỘT hình tĩnh, trần là ~4s`
          : `scene "${s.id}" (${s.template}): ${s.w} từ > ${cap} — ~${held}s, dài bất thường cho một mục bản tin`,
      );
    }
  }

  // Chữ trên màn hình không được chép lại lời thoại. Đo trên tập 1 series "Nếu
  // như": headline và câu đầu voiceText trùng gần từng chữ → tới giây 2 người
  // xem đã nhận đủ thông tin và bỏ đi (avg watch 7,52s / 45s, đỉnh bỏ ở 0:02).
  for (const s of script.scenes) {
    const td = s.templateData as Record<string, unknown>;
    const headline = typeof td.headline === "string" ? td.headline : "";
    if (!headline) continue;
    const firstSentence = (s.voiceText ?? "").split(/[.!?]/)[0] ?? "";
    if (words(firstSentence) < 3) continue;
    const ratio = overlapRatio(headline, firstSentence);
    if (ratio >= 0.8) {
      const msg =
        `scene "${s.id}": headline lặp lại ${Math.round(ratio * 100)}% câu đầu voiceText ` +
        `— chữ và giọng phải là hai tầng thông tin khác nhau, nếu không người xem hiểu xong ở giây 2 rồi lướt\n` +
        `      màn hình: "${headline.replace(/\|/g, " / ")}"\n` +
        `      giọng   : "${firstSentence.trim()}"`;
      if (td.template === "hook") errors.push(msg);
      else warns.push(msg);
    }
  }

  if (aspect === "9:16") {
    const flat = perScene.filter(
      (s) => s.template === "stat-hero" || s.template === "callout",
    ).length;
    if (flat * 2 > script.scenes.length) {
      warns.push(
        `stat-hero + callout = ${flat}/${script.scenes.length} scene (>50%) — bộ xương lặp lại video trước. Đổi vài cảnh sang feature-list / big-quote / comparison / timeline. (Bỏ qua nếu là listicle "N mục" phải đủ mục.)`,
      );
    }
  }

  if (errors.length) {
    failed = true;
    console.log(`FAIL ${file}  (nhịp · ${aspect} · ${total} từ ≈ ${est.toFixed(0)}s)`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    for (const w of warns) console.log(`  ! ${w}`);
  } else {
    console.log(
      `OK ${file}  (${aspect} · ${script.scenes.length} scene · ${total} từ ≈ ${est.toFixed(0)}s · ~${(est / script.scenes.length).toFixed(1)}s/cảnh)`,
    );
    for (const w of warns) console.log(`  ! ${w}`);
  }
}
process.exit(failed ? 1 : 0);
