import Fastify from "fastify";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import cookie from "@fastify/cookie";

import aircraftRoutes from "./routes/aircraft.js";
import airportRoutes from "./routes/airports.js";
import instructorRoutes from "./routes/instructors.js";
import flightRoutes from "./routes/flights.js";
import flightAwareRoutes from "./routes/flightaware.js";
import authRoutes from "./routes/auth.js";
import googleRoutes from "./routes/google.js";
import socialRoutes from "./routes/social.js";
import { registerAuth } from "./auth.js";

// Three ways this runs:
// - Development: Vite serves the website and forwards /api/* here with the prefix removed,
//   so the API's routes have no prefix.
// - Vercel: the same, with the website's Vercel project (apps/web/vercel.json) forwarding
//   /api/* to this one, which Vercel runs as a function.
// - `pnpm start` on a host of its own: this one server is the whole app. It serves the built
//   website (apps/web/dist, from `pnpm build`) and the API under /api.
// Either way the browser sees one origin, so the session cookie just works.
const production = process.env.NODE_ENV === "production";
const servesWeb = production && !process.env.VERCEL;
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
if (servesWeb && !existsSync(webDist)) {
  throw new Error(`No website build at ${webDist}. Run \`pnpm build\` first.`);
}

// Behind a hosting platform's proxy, trust its X-Forwarded-* headers (client IP, https).
const app = Fastify({ logger: true, trustProxy: production });
app.register(cookie);

registerAuth(app);

app.setErrorHandler((error, request, reply) => {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number(error.statusCode)
      : 500;

  if (statusCode < 500) {
    const message = error instanceof Error ? error.message : "Bad request";
    return reply.code(statusCode).send({ error: message });
  }

  request.log.error(error);
  return reply.code(500).send({ error: "Internal Server Error" });
});

app.get("/health", async (_request, reply) => {
  try {
    await pool.query("SELECT 1");
    return { status: "ok" };
  } catch (err) {
    app.log.error(err);
    return reply.code(503).send({ status: "unavailable" });
  }
});

// graceful shutdown on SIGINT (close the app, then pool.end())
async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`);
  await app.close(); // stop accepting requests, finish in-flight ones
  await pool.end();  // close all database connections
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));   // Ctrl+C
process.on("SIGTERM", () => void shutdown("SIGTERM")); // sent by hosting platforms and tsx watch restarts

app.register(
  async (api) => {
    api.register(airportRoutes);
    api.register(aircraftRoutes);
    api.register(instructorRoutes);
    api.register(flightRoutes);
    api.register(flightAwareRoutes);
    api.register(authRoutes);
    api.register(googleRoutes);
    api.register(socialRoutes);
  },
  { prefix: servesWeb ? "/api" : "" },
);

if (servesWeb) {
  // Loaded only here: on Vercel the website project serves the pages, and this package
  // can't load in Vercel's function runtime (it require()s an ES-module-only dependency).
  const { default: fastifyStatic } = await import("@fastify/static");
  app.register(fastifyStatic, {
    root: webDist,
    // Vite's /assets files have a content hash in their names, so they can be cached for good.
    setHeaders: (res, path) => {
      if (path.includes("/assets/")) res.header("Cache-Control", "public, max-age=31536000, immutable");
    },
  });
  // Any other page (/flights, /friends, …) is the single-page app: send index.html and let
  // the router take it from there. Unknown /api routes stay JSON 404s.
  app.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && !request.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "Not found" });
  });
}

// Locally, only this machine can reach the API. A host sets PORT and needs it reachable.
// Not awaited: on Vercel, listen() is taken over by the platform and its promise may never
// settle, which would leave this module (and every request) waiting forever.
app
  .listen({
    host: process.env.HOST ?? (production ? "0.0.0.0" : "localhost"),
    port: Number(process.env.PORT ?? 3000),
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });