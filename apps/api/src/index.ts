import Fastify from "fastify";
import { pool } from "./db.js";
import cookie from "@fastify/cookie";

import aircraftRoutes from "./routes/aircraft.js";
import airportRoutes from "./routes/airports.js";
import instructorRoutes from "./routes/instructors.js";
import flightRoutes from "./routes/flights.js";
import flightAwareRoutes from "./routes/flightaware.js";
import authRoutes from "./routes/auth.js";
import googleRoutes from "./routes/google.js";
import { registerAuth } from "./auth.js";

const app = Fastify({ logger: true });
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

app.register(airportRoutes);
app.register(aircraftRoutes);
app.register(instructorRoutes);
app.register(flightRoutes);
app.register(flightAwareRoutes);
app.register(authRoutes);
app.register(googleRoutes);

await app.listen({ port: 3000 });