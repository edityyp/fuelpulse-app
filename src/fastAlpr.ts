import { errorText } from "./api";
import { ocr, plateCandidates } from "./assist";

type AlprResult = { plate?: string; error?: string };
type PlateEvidence = { plate: string; votes: number; bestLength: number };
type ConsensusState = { evidence: PlateEvidence[]; lastAt: number; stable?: string };
type FallbackState = { until: number; lastResult?: string };
type LiveOcrWorker = {
  setParameters: (params: Record<string, string>) => Promise<void>;
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<void>;
};

const frameConsensus = new WeakMap<HTMLVideoElement, ConsensusState>();
const liveFallback = new WeakMap<HTMLVideoElement, FallbackState>();
const liveOcrWorkers = new WeakMap<HTMLVideoElement, Promise<LiveOcrWorker>>();
const CONSENSUS_WINDOW_MS = 7000;
const MAX_EVIDENCE = 8;
const FALLBACK_COOLDOWN_MS = 1800;

function normalizePlate(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1)
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}
function compatible(a: string, b: string) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (longer.startsWith(shorter) && longer.length - shorter.length <= 3) return true;
  return a.length === b.length && a.length >= 7 && editDistance(a, b) === 1;
}
function consensusPlate(video: HTMLVideoElement, raw: string) {
  const plate = normalizePlate(raw);
  if (!plate) return raw;
  const now = Date.now();
  let state = frameConsensus.get(video);
  if (!state || now - state.lastAt > CONSENSUS_WINDOW_MS) {
    state = { evidence: [], lastAt: now };
    frameConsensus.set(video, state);
  }
  state.lastAt = now;
  let match = state.evidence.find((item) => compatible(item.plate, plate));
  if (!match) {
    match = { plate, votes: 0, bestLength: plate.length };
    state.evidence.push(match);
  }
  match.votes += 1;
  if (plate.length > match.bestLength) { match.plate = plate; match.bestLength = plate.length; }
  state.evidence.sort((a, b) => b.votes - a.votes || b.bestLength - a.bestLength);
  state.evidence = state.evidence.slice(0, MAX_EVIDENCE);
  const best = state.evidence[0];
  if (best.votes >= 2) {
    const cluster = state.evidence.filter((item) => compatible(item.plate, best.plate));
    const votes = cluster.reduce((sum, item) => sum + item.votes, 0);
    const longest = cluster.reduce((current, item) => item.plate.length > current.length ? item.plate : current, best.plate);
    if (votes >= 2) state.stable = longest;
  }
  return state.stable ?? plate;
}
async function postAlpr(endpoint: string, blob: Blob): Promise<string> {
  const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": blob.type || "image/jpeg" }, body: blob });
  const body = (await response.json().catch(() => ({ error: "Plate recognition failed" }))) as AlprResult;
  if (!response.ok || !body.plate) throw Error(body.error ?? `ALPR failed (${response.status})`);
  return body.plate;
}
export async function fastAlprPhoto(file: File) {
  if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) throw Error("Select a JPEG, PNG, or WebP image under 4 MB");
  return postAlpr("/api/alpr", file);
}
async function captureFrame(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas unavailable");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(Error("Frame capture failed")), "image/jpeg", 0.92));
  return new File([blob], "live-plate.jpg", { type: "image/jpeg" });
}

async function getLiveOcrWorker(video: HTMLVideoElement): Promise<LiveOcrWorker> {
  let cached = liveOcrWorkers.get(video);
  if (!cached) {
    cached = import("tesseract.js").then(async ({ createWorker, PSM }) => {
      const worker = await createWorker("eng", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr", langPath: "/ocr" });
      await worker.setParameters({
        tessedit_pageseg_mode: String(PSM.SINGLE_LINE),
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      });
      return worker as unknown as LiveOcrWorker;
    });
    liveOcrWorkers.set(video, cached);
  }
  return cached;
}

function enhanceCanvas(canvas: HTMLCanvasElement, mode: number) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let value = gray;
    if (mode === 1) value = gray > 135 ? 255 : 0;
    if (mode === 2) value = Math.max(0, Math.min(255, (gray - 128) * 2.4 + 128));
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
}

async function browserPlateFallback(video: HTMLVideoElement): Promise<string> {
  const worker = await getLiveOcrWorker(video);
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw Error("Camera frame unavailable");

  const evidence = new Map<string, number>();
  const crops = [0.46, 0.34];
  for (let index = 0; index < crops.length; index += 1) {
    const cropHeight = Math.round(sourceHeight * crops[index]);
    const cropWidth = Math.round(sourceWidth * 0.94);
    const cropX = Math.round((sourceWidth - cropWidth) / 2);
    const cropY = Math.max(0, Math.round((sourceHeight - cropHeight) * (index === 0 ? 0.56 : 0.64)));
    const scale = Math.min(2.6, 1800 / cropWidth);
    for (let mode = 0; mode < 3; mode += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(cropWidth * scale));
      canvas.height = Math.max(1, Math.round(cropHeight * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.filter = "grayscale(1) contrast(1.55) saturate(0)";
      ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";
      if (mode) enhanceCanvas(canvas, mode);
      const result = await worker.recognize(canvas);
      for (const candidate of plateCandidates(result.data.text)) {
        const value = normalizePlate(candidate.value);
        const score = (candidate.quality >= 100 ? 4 : 1) + (result.data.confidence >= 55 ? 2 : result.data.confidence >= 30 ? 1 : 0);
        evidence.set(value, (evidence.get(value) ?? 0) + score);
      }
    }
  }

  const best = [...evidence.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
  if (!best || best[0].length < 6) throw Error("Plate unclear");
  return best[0];
}

async function browserFallback(video: HTMLVideoElement) { return browserPlateFallback(video); }

export async function fastAlprFrame(video: HTMLVideoElement, endpoint = "/api/alpr"): Promise<string> {
  if (video.readyState < 2 || video.videoWidth === 0) throw Error("Camera not ready — wait for the preview to appear");
  const fallback = liveFallback.get(video);
  if (fallback && Date.now() < fallback.until && fallback.lastResult) return consensusPlate(video, fallback.lastResult);
  try {
    const result = consensusPlate(video, await postAlpr(endpoint, await captureFrame(video)));
    liveFallback.delete(video);
    return result;
  } catch (primary) {
    try {
      const result = consensusPlate(video, await browserFallback(video));
      liveFallback.set(video, { until: Date.now() + FALLBACK_COOLDOWN_MS, lastResult: result });
      return result;
    } catch {
      liveFallback.set(video, { until: Date.now() + 750 });
      throw Error(errorText(primary));
    }
  }
}
export async function fastAlprWithFallback(file: File, fallback: (file: File) => Promise<string>) {
  try { return await fastAlprPhoto(file); }
  catch (primary) {
    try { return await fallback(file); }
    catch { throw Error(`FastALPR: ${errorText(primary)}. Retake closer without glare, or type the plate manually.`); }
  }
}
