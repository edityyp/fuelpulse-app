import { errorText } from "./api";

/** Send a static File to the FastALPR server endpoint and return the normalised plate string. */
export async function fastAlprPhoto(file: File) {
  if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024)
    throw Error("Select a JPEG, PNG, or WebP image under 4 MB");
  const response = await fetch("/api/alpr", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const body = (await response
    .json()
    .catch(() => ({ error: "Plate recognition failed" }))) as {
    plate?: string;
    error?: string;
  };
  if (!response.ok || !body.plate)
    throw Error(body.error ?? `FastALPR failed (${response.status})`);
  return body.plate;
}

/**
 * Capture a single JPEG frame from a live <video> element and send it to
 * the FastALPR server endpoint.  Returns the normalised plate string.
 *
 * Typical usage (plate-photo reward path):
 *   1. Open rear camera into a <video> ref.
 *   2. Call fastAlprFrame(video) when the plate fills the frame.
 *   3. Show the detected plate to staff for confirmation.
 *   4. POST to /api/rewards/redeem-by-plate with the confirmed plate.
 *
 * Throws if the video is not yet playing or the server cannot read the plate.
 */
export async function fastAlprFrame(video: HTMLVideoElement): Promise<string> {
  if (video.readyState < 2 || video.videoWidth === 0)
    throw Error("Camera not ready \u2014 wait for the preview to appear");
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
      0.92,
    ),
  );
  const response = await fetch("/api/alpr", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  const body = (await response
    .json()
    .catch(() => ({ error: "Plate recognition failed" }))) as {
    plate?: string;
    error?: string;
  };
  if (!response.ok || !body.plate)
    throw Error(body.error ?? `FastALPR failed (${response.status})`);
  return body.plate;
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
