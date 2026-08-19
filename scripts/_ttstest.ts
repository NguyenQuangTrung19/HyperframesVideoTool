import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import axios from "axios";
const key = process.env.AUSYNCLAB_API_KEY!;
const base = process.env.AUSYNCLAB_BASE_URL ?? "https://api.ausynclab.io/api/v1";
const voice = parseInt(process.env.PODCAST_AUSYNCLAB_VOICE_ID ?? process.env.AUSYNCLAB_VOICE_ID ?? "0", 10);
const model = process.env.PODCAST_AUSYNCLAB_MODEL_NAME ?? "myna-1-turbo";
console.log("voice:", voice, "model:", model, "base:", base, "key-tail:", key?.slice(-6));
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
try {
  const sub = await axios.post(`${base}/speech/text-to-speech`, {
    audio_name: `probe-${Date.now()}`, text: "Xin chào, đây là bài kiểm tra ngắn.",
    voice_id: voice, callback_url: null, speed: 1.0, model_name: model, language: "vi",
  }, { headers: { "X-API-Key": key, "Content-Type": "application/json" }, timeout: 30000 });
  const id = sub.data.result.audio_id;
  console.log("submitted audio_id:", id, "resp:", JSON.stringify(sub.data));
  for (let i=0;i<30;i++){ // up to ~90s
    await sleep(3000);
    const d = await axios.get(`${base}/speech/${id}`, { headers: { "X-API-Key": key }, timeout: 30000 });
    const r = d.data.result;
    console.log(`t+${(i+1)*3}s  state=${r.state}  audio_url=${r.audio_url?"YES":"(empty)"}`);
    if (r.state === "SUCCEED" || r.state === "FAILED") { console.log("FINAL:", JSON.stringify(d.data)); break; }
  }
} catch(e:any){
  console.log("SUBMIT/POLL ERR", e.response?.status, JSON.stringify(e.response?.data) ?? e.message);
}
