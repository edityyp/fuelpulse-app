import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const html = await readFile(resolve(process.cwd(), "dist", "admin-v7.html"), "utf8");
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.end(html);
  } catch (error) {
    console.error("Admin page failed to load", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Admin page unavailable");
  }
}
