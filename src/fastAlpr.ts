// Fast, plate-only OCR for the camera scanner.
//
// Design goals:
// - Only ever return plate-looking text (letters + digits, no stray words).
// - Return fast (~1-2s per call) so CameraAlprModal's 10s retry loop can
//   land a confident read well inside its window.
// - No network calls: tesseract.js runs fully in the browser.

import { createWorker, type Worker } from "tesseract.js";

// PSM 7 = "Treat the image as a single text line." A plate crop is exactly
// that, and restricting the segmentation mode both speeds up recognition and
// cuts down on spurious multi-line noise.
const SINGLE_LINE_PSM = "7";
const PLATE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const MIN_PLATE_LEN = 4;
const MAX_PLATE_LEN = 11;

// Roughly matches the green guide box drawn over the video preview in
// CameraAlprModal (a wide, short band centered in the frame). Cropping to it
// before OCR means anything outside the guide - pump signage, other cars,
// hands, etc. - never reaches the OCR engine in the first place.
const CROP_WIDTH_RATIO = 0.92;
const CROP_HEIGHT_RATIO = 0.3;

// A single warm worker is reused across every scan attempt (and across both
// the live-frame and photo-upload paths) so we only pay the model-load cost
// once per session instead of once per frame.
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng").then(async (worker) => {
      await worker.setParameters({
        tessedit_char_whitelist: PLATE_CHARSET,
        tessedit_pageseg_mode: SINGLE_LINE_PSM,
      });
      return worker;
    });
  }
  return workerPromise;
}

/**
 * Crops the source image down to the plate-guide region, upscales small
 * crops for legibility, and binarizes it (grayscale + threshold) so
 * tesseract has a clean, high-contrast, plate-only image to read.
 */
function prepareCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): HTMLCanvasElement {
  const cropW = sourceWidth * CROP_WIDTH_RATIO;
  const cropH = sourceHeight * CROP_HEIGHT_RATIO;
  const sx = (sourceWidth - cropW) / 2;
  const sy = (sourceHeight - cropH) / 2;

  // Upscale small crops - OCR accuracy drops sharply on tiny text.
  const scale = Math.max(900 / cropW, 1);
  const outW = Math.round(cropW * scale);
  const outH = Math.round(cropH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, outW, outH);

  // Grayscale + adaptive threshold: plates are high-contrast by design
  // (dark characters on a light background or vice versa), so a simple
  // mean-brightness threshold cleans up glare/shadow noise cheaply.
  const imageData = ctx.getImageData(0, 0, outW, outH);
  const data = imageData.data;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  const meanBrightness = total / (data.length / 4);

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const value = gray > meanBrightness ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/** Keeps only plate characters and uppercases - strips spaces, punctuation, and OCR noise. */
function cleanPlateText(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Rejects short/garbage reads so the panel never shows half-plates or noise words. */
function isPlausiblePlate(text: string): boolean {
  if (text.length < MIN_PLATE_LEN || text.length > MAX_PLATE_LEN) return false;
  return /[A-Z]/.test(text) && /[0-9]/.test(text);
}

async function recognizePlate(source: CanvasImageSource, width: number, height: number): Promise<string> {
  const canvas = prepareCanvas(source, width, height);
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas);
  const plate = cleanPlateText(data.text);

  if (!isPlausiblePlate(plate)) {
    throw new Error("No complete plate detected");
  }
  return plate;
}

/** Reads the current video frame. Called repeatedly by CameraAlprModal's capture loop. */
export async function fastAlprFrame(video: HTMLVideoElement): Promise<string> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Camera not ready");
  }
  return recognizePlate(video, video.videoWidth, video.videoHeight);
}

/** Reads a plate from an uploaded photo. */
export async function fastAlprPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    return await recognizePlate(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}
