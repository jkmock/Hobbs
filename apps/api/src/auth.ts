import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { validateSession } from "./sessions.js";

export const SESSION_COOKIE = "session";

// Add a userId field to Fastify's request type, for the whole app
declare module "fastify" {
  interface FastifyRequest {
    userId: string | null;
  }
}

export function registerAuth(app: FastifyInstance) {
  app.decorateRequest("userId", null);
  app.addHook("onRequest", async (request) => {

    const header = request.headers.authorization;
    const token =
      request.cookies[SESSION_COOKIE] ??
      (header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined);

    if (token) {
      request.userId = await validateSession(token);
    }
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.userId) {
    return reply.code(401).send({ error: "Not logged in" });
  }
}



export function getCurrentUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new Error("getCurrentUserId called on an unauthenticated route");
  }
  return request.userId;
}