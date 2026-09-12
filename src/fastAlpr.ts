import { errorText } from "./api";

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
const CONSENSUS_WINDOW_MS = 7000;
const MAX_EVIDENCE = 8;

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
  // A shorter OCR result that is an exact prefix of a longer result is the
  // most common way a mobile camera drops the final 1–2 characters.
  if (longer.startsWith(shorter) && longer.length - shorter.length <= 3) return true;
  // Allow one OCR substitution for otherwise equal-length reads. This handles
  // occasional frame-to-frame confusion without merging unrelated plates.
  return a.length === b.length && a.length >= 5 && editDistance(a, b) === 1;
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

  // Keep only the strongest recent candidates so a noisy camera cannot build
  // an unbounded in-memory history.
  state.evidence.sort(
    (a, b) => b.votes - a.votes || b.bestLength - a.bestLength,
  );
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
  const body = (await response
    .json()
    .catch(() => ({ error: "Plate recognition failed" }))) as AlprResult;
  if (!response.ok || !body.plate)
    throw Error(body.error ?? `ALPR failed (${response.status})`);
  return body.plate;
}

/** Send a static File to the FastALPR server endpoint and return the normalised plate string. */
export async function fastAlprPhoto(file: File) {
  if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024)
    throw Error("Select a JPEG, PNG, or WebP image under 4 MB");
  return postAlpr("/api/alpr", file);
}

/**
 * Capture a live frame and pass its reading through a short-lived per-camera
 * consensus. Compatible readings such as AB12CD3 and AB12CD34 are treated as
 * the same plate, with the longer confirmed reading preferred.
 */
export async function fastAlprFrame(
  video: HTMLVideoElement,
  endpoint = "/api/alpr",
): Promise<string> {
  if (video.readyState < 2 || video.videoWidth === 0)
    throw Error("Camera not ready — wait for the preview to appear");
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas unavailable");
  ctx.drawImage(video, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Frame capture failed"))),
      "image/jpeg",
      0.9,
    ),
  );
  const result = await postAlpr(endpoint, blob);
  return consensusPlate(video, result);
}

/** Try FastALPR first; fall back to local OCR on any error. */
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
      throw Error(
        `FastALPR: ${errorText(primary)}. Retake closer without glare, or type the plate manually.`,
      );
    }
  }
}
