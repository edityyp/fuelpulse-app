import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../server/app.js";

let appPromise: ReturnType<typeof buildApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) {
    appPromise = buildApp();
  }
  const app = await appPromise;
  await app.ready();
  app.server.emit("request", req, res);
}
