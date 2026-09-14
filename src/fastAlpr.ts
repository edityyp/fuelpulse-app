import { ocr, plateCandidates } from "./assist";

type LiveOcrWorker = {
  setParameters: (params: Record<string, string | number>) => Promise<void>;
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<void>;
};
type Evidence = { plate: string; votes: number; score: number; bestLength: number };
type State = { evidence: Evidence[]; lastAt: number };

const states = new WeakMap<HTMLVideoElement, State>();
const workers = new WeakMap<HTMLVideoElement, Promise<LiveOcrWorker>>();
const WINDOW_MS = 10000;

function normalize(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function distance(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let row = prev;
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
function compatible(a: string, b: string) {
  if (a === b) return true;
  const short = a.length <= b.length ? a : b, long = a.length <= b.length ? b : a;
  return (long.startsWith(short) && long.length - short.length <= 3) || (a.length === b.length && a.length >= 7 && distance(a, b) <= 1);
}
function indianPlateShape(value: string) {
  return /^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|[A-Z]{2}\d{2,3}[A-Z]{0,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/.test(value) && value.length >= 7;
}
function addEvidence(video: HTMLVideoElement, raw: string, score: number) {
  const plate = normalize(raw); if (!plate) return undefined;
  const now = Date.now(); let state = states.get(video);
  if (!state || now - state.lastAt > WINDOW_MS) { state = { evidence: [], lastAt: now }; states.set(video, state); }
  state.lastAt = now;
  let match = state.evidence.find(item => compatible(item.plate, plate));
  if (!match) { match = { plate, votes: 0, score: 0, bestLength: plate.length }; state.evidence.push(match); }
  match.votes += 1; match.score += score; if (plate.length > match.bestLength) { match.plate = plate; match.bestLength = plate.length; }
  const best = [...state.evidence].sort((a,b) => b.score - a.score || b.votes - a.votes || b.bestLength - a.bestLength)[0];
  if (!best) return undefined;
  const cluster = state.evidence.filter(item => compatible(item.plate, best.plate));
  const votes = cluster.reduce((sum,item) => sum + item.votes, 0);
  const longest = cluster.reduce((v,item) => item.plate.length > v.length ? item.plate : v, best.plate);
  // A production transaction must never be finalized from one noisy frame.
  return votes >= 3 && longest.length >= 7 && (indianPlateShape(longest) || votes >= 4) ? longest : undefined;
}

async function getWorker(video: HTMLVideoElement) {
  let cached = workers.get(video);
  if (!cached) {
    cached = import("tesseract.js").then(async ({ createWorker, PSM }) => {
      // Do not point at /ocr: the production build does not ship those files.
      // Tesseract resolves its versioned worker/core/language assets from its CDN.
      const worker = await createWorker("eng", 1);
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        preserve_interword_spaces: "0",
      });
      return worker as unknown as LiveOcrWorker;
    });
    workers.set(video, cached);
  }
  return cached;
}

function prepare(canvas: HTMLCanvasElement, mode: number) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return;
  const image = ctx.getImageData(0,0,canvas.width,canvas.height), d = image.data;
  for (let i=0;i<d.length;i+=4) {
    const g = .299*d[i] + .587*d[i+1] + .114*d[i+2];
    let v = g;
    if (mode===1) v = g>110?255:0;
    else if (mode===2) v = g>140?255:0;
    else if (mode===3) v = g>170?255:0;
    else if (mode===4) v = Math.max(0,Math.min(255,(g-128)*2.8+128));
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(image,0,0);
}

async function recognizeFrame(video: HTMLVideoElement): Promise<string | undefined> {
  if (video.readyState < 2 || !video.videoWidth) throw Error("Camera not ready — wait for the preview to appear");
  const worker = await getWorker(video), sw=video.videoWidth, sh=video.videoHeight;
  const evidence = new Map<string,number>();
  const bands = [{y:.28,h:.38},{y:.40,h:.38},{y:.52,h:.38}];
  for (const band of bands) {
    const cw=Math.round(sw*.94), ch=Math.round(sh*band.h), cx=Math.round((sw-cw)/2), cy=Math.max(0,Math.min(sh-ch,Math.round(sh*band.y)));
    const scale=Math.min(2.8,2400/cw), canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(cw*scale)); canvas.height=Math.max(1,Math.round(ch*scale));
    const ctx=canvas.getContext("2d",{willReadFrequently:true}); if(!ctx) continue;
    ctx.imageSmoothingEnabled=true; ctx.filter="grayscale(1) contrast(1.9)"; ctx.drawImage(video,cx,cy,cw,ch,0,0,canvas.width,canvas.height); ctx.filter="none";
    prepare(canvas, (Date.now() + Math.round(band.y*100)) % 5);
    const result=await worker.recognize(canvas);
    for(const candidate of plateCandidates(result.data.text)) {
      const value=normalize(candidate.value); if(value.length<7||value.length>15) continue;
      const shape=indianPlateShape(value)?7:0, conf=result.data.confidence>=75?5:result.data.confidence>=55?4:result.data.confidence>=35?2:1;
      evidence.set(value,(evidence.get(value)??0)+shape+conf+(candidate.quality>=100?2:0));
    }
  }
  const best=[...evidence.entries()].sort((a,b)=>b[1]-a[1]||b[0].length-a[0].length)[0];
  if(!best) throw Error("Plate not readable yet");
  return addEvidence(video,best[0],best[1]);
}

export async function fastAlprFrame(video: HTMLVideoElement) { const value=await recognizeFrame(video); if(!value) throw Error("Plate not stable yet"); return value; }
export async function fastAlprPhoto(file: File) { return ocr(file); }
export async function fastAlprWithFallback(file: File, _fallback?: (file: File)=>Promise<string>) { return ocr(file); }
