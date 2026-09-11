import { errorText } from "./api";

type AlprResult = {
  plate?: string;
  error?: string;
};

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
 * Capture a single JPEG frame from a live <video> element and send it to
 * the ALPR endpoint.
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
  return postAlpr(endpoint, blob);
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
