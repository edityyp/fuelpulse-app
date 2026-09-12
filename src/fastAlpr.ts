import { errorText } from "./api";
import { ocr } from "./assist";

type AlprResult = {
  plate?: string;
  error?: string;
};

type PlateEvidence = {
  plate: string;
  votes: number;
  bestLength: number;
};

type ConsensusState = {
  evidence: PlateEvidence[];
  lastAt: number;
  stable?: string;
};

const frameConsensus = new WeakMap<HTMLVideoElement, ConsensusState>();
const liveFallback = new WeakMap<HTMLVideoElement, { until: number }>();
const CONSENSUS_WINDOW_MS = 7000;
const MAX_EVIDENCE = 8;
// Vercel cannot run the Python FastALPR worker, so browser OCR is a
// compatibility fallback. Throttle it to avoid creating OCR work on every frame.
const FALLBACK_COOLDOWN_MS = 2500;

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
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
  if (plate.length > match.bestLength) {
    match.plate = plate;
    match.bestLength = plate.length;
  }

  state.evidence.sort((a, b) => b.votes - a.votes || b.bestLength - a.bestLength);
  state.evidence = state.evidence.slice(0, MAX_EVIDENCE);

  const best = state.evidence[0];
  if (best.votes >= 2) {
    const sameCluster = state.evidence.filter((item) => compatible(item.plate, best.plate));
    const clusterVotes = sameCluster.reduce((sum, item) => sum + item.votes, 0);
    const longest = sameCluster.reduce(
      (current, item) => (item.plate.length > current.length ? item.plate : current),
      best.plate,
    );
    if (clusterVotes >= 2) state.stable = longest;
  }
  return state.stable ?? plate;
}

async function postAlpr(endpoint: string, blob: Blob): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  const body = (await response.json().catch(() => ({ error: "Plate recognition failed" }))) as AlprResult;
  if (!response.ok || !body.plate) throw Error(body.error ?? `ALPR failed (${response.status})`);
  return body.plate;
}

export async function fastAlprPhoto(file: File) {
  if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024)
    throw Error("Select a JPEG, PNG, or WebP image under 4 MB");
  return postAlpr("/api/alpr", file);
}

async function captureFrame(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas unavailable");
  ctx.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(Error("Frame capture failed"))), "image/jpeg", 0.92),
  );
  return new File([blob], "live-plate.jpg", { type: "image/jpeg" });
}

async function browserFallback(video: HTMLVideoElement) {
  const file = await captureFrame(video);
  return ocr(file);
}

export async function fastAlprFrame(
  video: HTMLVideoElement,
  endpoint = "/api/alpr",
): Promise<string> {
  if (video.readyState < 2 || video.videoWidth === 0)
    throw Error("Camera not ready — wait for the preview to appear");

  const fallback = liveFallback.get(video);
  if (fallback && Date.now() < fallback.until) return browserFallback(video);

  try {
    const file = await captureFrame(video);
    const result = await postAlpr(endpoint, file);
    return consensusPlate(video, result);
  } catch (primary) {
    liveFallback.set(video, { until: Date.now() + FALLBACK_COOLDOWN_MS });
    try {
      const result = await browserFallback(video);
      return consensusPlate(video, result);
    } catch {
      throw Error(errorText(primary));
    }
  }
}

export async function fastAlprWithFallback(
  file: File,
  fallback: (file: File) => Promise<string>,
) {
  try {
    return await fastAlprPhoto(file);
  } catch (primary) {
    try {
      return await fallback(file);
    } catch {
      throw Error(`FastALPR: ${errorText(primary)}. Retake closer without glare, or type the plate manually.`);
    }
  }
}
