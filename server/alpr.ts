import type { FastifyInstance } from "fastify";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { actor } from "./auth.js";
import { fail } from "./db.js";
import { plate } from "../shared/contracts.js";

type Pending = {
  resolve: (value: Recognition) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};
type Recognition = {
  plate: string;
  confidence: number;
  ocr_confidence: number;
  detection_confidence: number;
};
let worker: ChildProcessWithoutNullStreams | undefined;
const pending = new Map<string, Pending>();
function start() {
  if (worker && !worker.killed) return worker;
  worker = spawn("python3", ["server/alpr_worker.py"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: worker.stdout });
  lines.on("line", (line) => {
    try {
      const message = JSON.parse(line) as {
        id?: string;
        ok: boolean;
        error?: string;
      } & Partial<Recognition>;
      if (!message.id) return;
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(message.id);
      if (!message.ok)
        item.reject(Error(message.error ?? "Plate recognition failed"));
      else item.resolve(message as Recognition);
    } catch {
      void 0;
    }
  });
  worker.stderr.on("data", (data) => {
    if (process.env.NODE_ENV !== "test")
      process.stderr.write(`[fast-alpr] ${String(data)}`);
  });
  worker.on("exit", () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(Error("Plate recognition service restarted"));
    }
    pending.clear();
    worker = undefined;
  });
  return worker;
}
export function recognizeImage(image: Buffer) {
  return new Promise<Recognition>((resolve, reject) => {
    const id = randomUUID(),
      process = start(),
      timer = setTimeout(() => {
        pending.delete(id);
        reject(Error("Plate recognition timed out"));
      }, 30000);
    pending.set(id, { resolve, reject, timer });
    process.stdin.write(
      JSON.stringify({ id, image: image.toString("base64") }) + "\n",
    );
  });
}
export function alprRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    ["image/jpeg", "image/png", "image/webp"],
    { parseAs: "buffer", bodyLimit: 4 * 1024 * 1024 },
    (_request, body, done) => done(null, body),
  );
  app.post("/api/alpr", async (request) => {
    await actor(request);
    const image = request.body as Buffer;
    if (!Buffer.isBuffer(image) || image.length < 128)
      fail(400, "Invalid image");
    try {
      const result = await recognizeImage(image);
      const normalized = plate.safeParse(result.plate);
      if (!normalized.success) fail(422, "Plate format was unclear");
      return { ...result, plate: normalized.data, engine: "fast-alpr" };
    } catch (error) {
      fail(
        422,
        error instanceof Error ? error.message : "Plate recognition failed",
      );
    }
  });
}
