/**
 * Phase-1 smoke test for AusyncLab TTS (https://ausynclab.io).
 *
 * Steps:
 *   1) GET /voices/list   — print available Vietnamese voices + IDs.
 *   2) POST /speech/text-to-speech — submit a Vietnamese football sample
 *      that includes Tây names (Mbappé / Dembélé / Bernabéu) — the case where
 *      VieNeu-TTS goes silent. See feedback_vieneu_english_silence_bug.
 *   3) GET /speech/{audio_id} polling until status=SUCCEEDED, then download.
 *
 * Run:   npx tsx scripts/test-ausynclab.ts
 *        npx tsx scripts/test-ausynclab.ts --voice 1234       (override voice)
 *        npx tsx scripts/test-ausynclab.ts --model myna-2     (override model)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import axios, { AxiosError } from "axios";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = "https://api.ausynclab.io/api/v1";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;

const SAMPLE_TEXT_DIACRITICS =
  "Chào mừng các bạn đến với Sports For All Ti Vi. Tâm điểm tuần này " +
  "là cuộc đối đầu giữa Real Madrid và Paris Saint-Germain tại Bernabéu. " +
  "Mbappé tái ngộ đội bóng cũ, còn Dembélé sẽ là nhạc trưởng bên kia chiến tuyến. " +
  "Liệu pha chọc khe quen thuộc của Dembélé có đủ sức xuyên thủng hàng thủ chủ nhà?";

// ASCII variant — strips foreign diacritics + hyphen normalization on Tây names.
// Hypothesis: combining chars in "Mbappé/Dembélé/Bernabéu" confuse the model
// and produce mid-word breaks like "tâm... điểm".
const SAMPLE_TEXT_ASCII =
  "Chào mừng các bạn đến với Sports For All Ti Vi. Tâm điểm tuần này " +
  "là cuộc đối đầu giữa Real Madrid và Paris Saint Germain tại Bernabeu. " +
  "Mbappe tái ngộ đội bóng cũ, còn Dembele sẽ là nhạc trưởng bên kia chiến tuyến. " +
  "Liệu pha chọc khe quen thuộc của Dembele có đủ sức xuyên thủng hàng thủ chủ nhà?";

interface Voice {
  id: number;
  name: string;
  language: string;
  gender: string;
  age: string;
  use_case: string;
  audio_url: string;
}

interface ListResp { status: number; result: Voice[]; }
interface SubmitResp { status: number; result: { audio_id: number }; }
interface DetailResp {
  status: number; // HTTP-ish outer code
  result: {
    id: number;
    state: string; // observed: PROCESSING | SUCCEED | FAILED
    audio_url?: string;
    audio_url_stream?: string;
    subtitle_url?: string;
    duration?: number;
    voice_name?: string;
    credits_used?: number;
    sample_rate?: number;
  };
  message?: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const out: { voice?: number; model?: string; ascii?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--voice" && args[i + 1]) out.voice = parseInt(args[++i], 10);
    if (args[i] === "--model" && args[i + 1]) out.model = args[++i];
    if (args[i] === "--ascii") out.ascii = true;
  }
  return out;
}

async function main() {
  const apiKey = process.env.AUSYNCLAB_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "Missing AUSYNCLAB_API_KEY in .env.local.\n" +
      "Get one at https://ausynclab.io → Dashboard → API Keys, then add:\n" +
      "  AUSYNCLAB_API_KEY=...\n"
    );
    process.exit(1);
  }

  const headers = { "X-API-Key": apiKey };
  const { voice: voiceArg, model: modelArg, ascii } = parseArgs();
  const model = modelArg ?? process.env.AUSYNCLAB_MODEL_NAME ?? "myna-2";
  const sampleText = ascii ? SAMPLE_TEXT_ASCII : SAMPLE_TEXT_DIACRITICS;
  console.log(`  text variant: ${ascii ? "ASCII (Mbappe/Dembele/Bernabeu)" : "DIACRITICS (Mbappé/Dembélé/Bernabéu)"}`);

  // ── 1) List voices (user-cloned only — public library not exposed) ───────
  console.log("→ GET /voices/list");
  const listResp = await axios.get<ListResp>(`${BASE}/voices/list`, { headers, timeout: 30_000 });
  const allVoices = listResp.data.result ?? [];
  const viVoices = allVoices.filter((v) => v.language?.toLowerCase().startsWith("vi"));
  console.log(`  → ${viVoices.length} Vietnamese voices cloned on this account (of ${allVoices.length} total).`);
  for (const v of viVoices) {
    console.log(`    [${v.id}] ${v.name.padEnd(20)} ${v.gender.padEnd(8)} ${v.age.padEnd(10)} ${v.use_case}`);
  }

  // Pick voice: --voice arg → AUSYNCLAB_VOICE_ID env → first VN voice in list.
  const envVoice = process.env.AUSYNCLAB_VOICE_ID?.trim();
  const voiceId =
    voiceArg ??
    (envVoice ? parseInt(envVoice, 10) : undefined) ??
    viVoices[0]?.id;
  if (!voiceId) {
    console.error(
      "\n  ✗ No voice_id available.\n" +
      "    /voices/list returned nothing AND --voice / AUSYNCLAB_VOICE_ID not set.\n" +
      "    → Go to https://ausynclab.io/voices, pick a voice, copy its numeric ID,\n" +
      "      then either:\n" +
      "        (a) set AUSYNCLAB_VOICE_ID=<id> in .env.local, OR\n" +
      "        (b) re-run with --voice <id>",
    );
    process.exit(1);
  }
  const picked = viVoices.find((v) => v.id === voiceId);
  console.log(
    `  → using voice_id=${voiceId}` +
    (picked ? ` (${picked.name}, ${picked.gender}, ${picked.use_case})` : " (public library voice — passing through)")
  );
  console.log(`  → using model=${model}`);

  // ── 2) Submit TTS ─────────────────────────────────────────────────────────
  console.log("\n→ POST /speech/text-to-speech");
  console.log(`  text length: ${sampleText.length} chars`);
  const submitBody = {
    audio_name: `ausynclab-test-${ascii ? "ascii-" : ""}${Date.now()}`,
    text: sampleText,
    voice_id: voiceId,
    callback_url: null, // OpenAPI says nullable — we poll instead
    speed: 1.0,
    model_name: model,
    language: "vi",
  };
  let audioId: number;
  try {
    const submit = await axios.post<SubmitResp>(
      `${BASE}/speech/text-to-speech`,
      submitBody,
      { headers, timeout: 30_000 },
    );
    audioId = submit.data.result.audio_id;
    console.log(`  → audio_id=${audioId}`);
  } catch (e) {
    const ax = e as AxiosError;
    const status = ax.response?.status;
    const detail = (ax.response?.data as { detail?: string } | undefined)?.detail;
    if (status === 403 && detail === "paid_plan_only") {
      console.error(
        "\n  ✗ 403 paid_plan_only — AusyncLab TTS API is gated to paid plans.\n" +
        "    Free API key authenticates but cannot call /speech/text-to-speech.\n" +
        "    → Upgrade plan at https://ausynclab.io and retry.",
      );
    } else {
      console.error("  ✗ Submit failed:", status, JSON.stringify(ax.response?.data));
    }
    process.exit(1);
  }

  // ── 3) Poll until done ────────────────────────────────────────────────────
  console.log(`\n→ Polling GET /speech/${audioId} every ${POLL_INTERVAL_MS}ms (max ${POLL_TIMEOUT_MS / 1000}s)`);
  const started = Date.now();
  let audioUrl: string | undefined;
  let subtitleUrl: string | undefined;
  let durationSec: number | undefined;
  let creditsUsed: number | undefined;
  let lastState = "";
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const detail = await axios.get<DetailResp>(`${BASE}/speech/${audioId}`, { headers, timeout: 30_000 });
    const s = detail.data.result;
    if (s.state !== lastState) {
      console.log(`  [${Math.round((Date.now() - started) / 1000)}s] state=${s.state}`);
      lastState = s.state;
    }
    if (s.state === "SUCCEED" && s.audio_url) {
      audioUrl = s.audio_url;
      subtitleUrl = s.subtitle_url;
      durationSec = s.duration;
      creditsUsed = s.credits_used;
      break;
    }
    if (s.state === "FAILED") {
      console.error("  ✗ Generation failed");
      process.exit(1);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  if (!audioUrl) {
    console.error(`  ✗ Polling timeout after ${POLL_TIMEOUT_MS / 1000}s`);
    process.exit(1);
  }

  // ── 4) Download audio + SRT ───────────────────────────────────────────────
  await mkdir("output", { recursive: true });
  const wavPath = join("output", `ausynclab-test-${audioId}.wav`);
  console.log(`\n→ Downloading audio: ${audioUrl}`);
  const audio = await axios.get<ArrayBuffer>(audioUrl, { responseType: "arraybuffer", timeout: 60_000 });
  await writeFile(wavPath, Buffer.from(audio.data));
  console.log(`  ✓ ${wavPath} (${(audio.data.byteLength / 1024).toFixed(1)} KB${durationSec ? `, ${durationSec.toFixed(2)}s` : ""})`);

  if (subtitleUrl) {
    const srtPath = join("output", `ausynclab-test-${audioId}.srt`);
    const srt = await axios.get<ArrayBuffer>(subtitleUrl, { responseType: "arraybuffer", timeout: 30_000 });
    await writeFile(srtPath, Buffer.from(srt.data));
    console.log(`  ✓ ${srtPath} (${(srt.data.byteLength / 1024).toFixed(1)} KB)`);
  }
  if (creditsUsed !== undefined) console.log(`  credits_used: ${creditsUsed}`);

  console.log("\n✅ Done. Play the file and judge:");
  console.log("   - Pronunciation of Mbappé / Dembélé / Bernabéu");
  console.log("   - Any silence gaps (the VieNeu failure mode)");
  console.log("   - Natural rhythm + tonal expressiveness");
  console.log("\nTry other voices:");
  for (const v of viVoices.slice(0, 5)) {
    console.log(`   npx tsx scripts/test-ausynclab.ts --voice ${v.id}    # ${v.name}`);
  }
}

main().catch((e) => {
  const ax = e as AxiosError;
  if (ax.isAxiosError) {
    console.error("HTTP error:", ax.response?.status, JSON.stringify(ax.response?.data ?? ax.message));
  } else {
    console.error(e);
  }
  process.exit(1);
});
