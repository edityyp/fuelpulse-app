import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import files from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { authRoutes } from "./auth.js";
import { routes } from "./routes.js";
import { customerRoutes } from "./customer.js";
import { alprRoutes } from "./alpr.js";
import { phase1Routes } from "./phase1.js";
import { pool } from "./db.js";

export async function buildApp() {
  const configuredOrigins = (process.env.APP_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (
    process.env.NODE_ENV === "production" &&
    configuredOrigins.some((value) => !value.startsWith("https://"))
  )
    throw Error("Production requires HTTPS");

  const app = Fastify({
    bodyLimit: 16384,
    trustProxy:
      process.env.NODE_ENV === "production"
        ? (_address, hop) => hop === 0
        : false,
    logger: {
      level: "warn",
      redact: [
        "req.headers.cookie",
        "req.headers.authorization",
        "req.body",
        "res.headers.set-cookie",
      ],
    },
    requestTimeout: 35000,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        workerSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" && configuredOrigins.some((value) => value.startsWith("https://"))
            ? []
            : null,
      },
    },
  });
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
        const forwardedProto = req.headers["x-forwarded-proto"];
        const protocol =
          process.env.NODE_ENV === "production"
            ? "https"
            : typeof forwardedProto === "string"
              ? forwardedProto.split(",")[0].trim()
              : "http";
        const requestHostOrigin = req.headers.host
          ? `${protocol}://${req.headers.host}`
          : null;
        const requestOrigin = req.headers.origin.replace(/\/$/, "");
        const originAllowed =
          configuredOrigins.includes(requestOrigin) ||
          requestOrigin === requestHostOrigin;

        if (!originAllowed)
          return reply.code(403).send({ error: "Invalid origin" });
      }
    }
  });
  app.setErrorHandler((error, _req, reply) => {
    const e = error as { statusCode?: number; code?: string; message?: string };
    const status =
      error instanceof ZodError
        ? 400
        : e.code === "23505"
          ? 409
          : ["23503", "42501", "22P02"].includes(e.code ?? "")
            ? 400
            : (e.statusCode ?? 500);
    reply.code(status).send({
      error:
        status >= 500
          ? "Server error; retry safely"
          : status === 400
            ? "Invalid request"
            : status === 409
              ? "Conflict; request cannot be applied"
              : (e.message ?? "Request failed"),
    });
  });
  app.get("/api/customer/config", async () => {
    const row = (await pool.query("select slug,name from app.organizations order by created_at asc limit 1")).rows[0];
    if (!row) return { station: "", name: "FuelPulse" };
    return { station: row.slug, name: row.name };
  });
  await authRoutes(app);
  routes(app);
  customerRoutes(app);
  alprRoutes(app);
  phase1Routes(app);
  app.get("/api/health", async () => {
    await pool.query("select 1");
    return { status: "ok" };
  });
  if (existsSync(resolve("dist"))) {
    await app.register(files, { root: resolve("dist") });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ error: "Not found" })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
