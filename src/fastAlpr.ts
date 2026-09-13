import { ocr, plateCandidates } from "./assist";

type LiveOcrWorker = {
  setParameters: (params: Record<string, string>) => Promise<void>;
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<void>;
};
type Evidence = { plate: string; votes: number; bestLength: number };
type State = { evidence: Evidence[]; lastAt: number; stable?: string };

const states = new WeakMap<HTMLVideoElement, State>();
const workers = new WeakMap<HTMLVideoElement, Promise<LiveOcrWorker>>();
const WINDOW_MS = 7000;
const MAX_EVIDENCE = 8;

function normalize(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function distance(a: string, b: string) {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}
function compatible(a: string, b: string) {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (longer.startsWith(shorter) && longer.length - shorter.length <= 3) return true;
  return a.length === b.length && a.length >= 7 && distance(a, b) === 1;
}
function addEvidence(video: HTMLVideoElement, raw: string) {
  const plate = normalize(raw);
  if (!plate) return plate;
  const now = Date.now();
  let state = states.get(video);
  if (!state || now - state.lastAt > WINDOW_MS) {
    state = { evidence: [], lastAt: now };
    states.set(video, state);
  }
  state.lastAt = now;
  let match = state.evidence.find((item) => compatible(item.plate, plate));
  if (!match) {
    match = { plate, votes: 0, bestLength: plate.length };
    state.evidence.push(match);
  }
  match.votes += 1;
  if (plate.length > match.bestLength) {
    match.plate = plate;
    match.bestLength = plate.length;
  }
  state.evidence.sort((a, b) => b.votes - a.votes || b.bestLength - a.bestLength);
  state.evidence = state.evidence.slice(0, MAX_EVIDENCE);
  const best = state.evidence[0];
  if (best?.votes >= 2) {
    const cluster = state.evidence.filter((item) => compatible(item.plate, best.plate));
    const votes = cluster.reduce((sum, item) => sum + item.votes, 0);
    const longest = cluster.reduce((current, item) => item.plate.length > current.length ? item.plate : current, best.plate);
    if (votes >= 2) state.stable = longest;
  }
  return state.stable ?? plate;
}

async function getWorker(video: HTMLVideoElement) {
  let cached = workers.get(video);
  if (!cached) {
    cached = import("tesseract.js").then(async ({ createWorker, PSM }) => {
      const worker = await createWorker("eng", 1, { workerPath: "/ocr/worker.min.js", corePath: "/ocr", langPath: "/ocr" });
      await worker.setParameters({ tessedit_pageseg_mode: String(PSM.SINGLE_LINE), tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" });
      return worker as unknown as LiveOcrWorker;
    });
    workers.set(video, cached);
  }
  return cached;
}
function enhance(canvas: HTMLCanvasElement, mode: number) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let value = gray;
    if (mode === 1) value = gray > 125 ? 255 : 0;
    if (mode === 2) value = gray > 175 ? 255 : 0;
    if (mode === 3) value = Math.max(0, Math.min(255, (gray - 128) * 2.2 + 128));
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
}
async function recognizeFrame(video: HTMLVideoElement): Promise<string> {
  if (video.readyState < 2 || !video.videoWidth) throw Error("Camera not ready — wait for the preview to appear");
  const worker = await getWorker(video);
  const sw = video.videoWidth, sh = video.videoHeight;
  const evidence = new Map<string, number>();
  const crops = [0.48, 0.34];
  for (let index = 0; index < crops.length; index += 1) {
    const cropHeight = Math.round(sh * crops[index]);
    const cropWidth = Math.round(sw * 0.96);
    const cropX = Math.round((sw - cropWidth) / 2);
    const cropY = Math.max(0, Math.round((sh - cropHeight) * (index === 0 ? 0.52 : 0.66)));
    const scale = Math.min(2.5, 1700 / cropWidth);
    for (let mode = 0; mode < 4; mode += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(cropWidth * scale));
      canvas.height = Math.max(1, Math.round(cropHeight * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.filter = "grayscale(1) contrast(1.8) saturate(0)";
      ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";
      if (mode) enhance(canvas, mode);
      const result = await worker.recognize(canvas);
      for (const candidate of plateCandidates(result.data.text)) {
        const value = normalize(candidate.value);
        const score = (candidate.quality >= 100 ? 4 : 1) + (result.data.confidence >= 55 ? 2 : result.data.confidence >= 30 ? 1 : 0);
        evidence.set(value, (evidence.get(value) ?? 0) + score);
      }
    }
  }
  const best = [...evidence.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
  if (!best || best[0].length < 6) throw Error("Plate unclear");
  return best[0];
}

export async function fastAlprFrame(video: HTMLVideoElement, _endpoint?: string) {
  return addEvidence(video, await recognizeFrame(video));
}
export async function fastAlprPhoto(file: File) {
  if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) throw Error("Select an image under 8 MB");
  return ocr(file);
}
export async function fastAlprWithFallback(file: File, _fallback?: (file: File) => Promise<string>) {
  return ocr(file);
}
