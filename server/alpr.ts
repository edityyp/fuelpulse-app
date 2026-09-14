import type { FastifyInstance } from "fastify";
import { fail } from "./db.js";

/**
 * Server-side FastALPR has been retired. Plate recognition is now performed
 * on-device in the browser using the free Tesseract OCR engine, avoiding a
 * Python/model runtime in production serverless deployments.
 */
export function recognizeImage(_image: Buffer): never {
  fail(410, "Server ALPR is retired; use the on-device plate scanner");
}

export function alprRoutes(app: FastifyInstance) {
  app.post("/api/alpr", async () => {
    fail(410, "Server ALPR is retired; use the on-device plate scanner");
  });
}
