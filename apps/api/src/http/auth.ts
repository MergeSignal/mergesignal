import type { FastifyInstance } from "fastify";
import { createHash } from "crypto";
import { queries } from "../db.js";
import { sendProblem } from "../problem.js";

declare module "fastify" {
  interface FastifyRequest {
    authenticatedOwner?: string;
  }
}

export function registerAuth(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const url = String(req.url ?? "");
    const method = String(req.method ?? "GET").toUpperCase();
    const path = url.startsWith("/v1/") ? url.slice("/v1".length) : url;
    const isPublic =
      (method === "GET" && (path === "/health" || path === "/openapi.json" || path === "/docs" || path === "/")) ||
      (method === "POST" && path === "/github/webhook");

    if (isPublic) return;

    const h = String(req.headers.authorization ?? "");
    if (!h.startsWith("Bearer ")) {
      return sendProblem(reply, req, {
        status: 401,
        title: "Unauthorized",
        detail: "Missing or invalid API key",
      });
    }

    const providedKey = h.slice("Bearer ".length).trim();
    if (!providedKey) {
      return sendProblem(reply, req, {
        status: 401,
        title: "Unauthorized",
        detail: "Missing or invalid API key",
      });
    }

    // Validate org-scoped API keys
    const keyHash = hashApiKey(providedKey);
    try {
      const apiKey = await queries.apiKeys.findByHash(keyHash);
      if (apiKey) {
        req.authenticatedOwner = apiKey.owner;
        // Update last_used_at asynchronously
        queries.apiKeys.updateLastUsed(keyHash).catch(() => {});
        return;
      }
    } catch {
      // Database error - fail closed for security
      // Log the error for debugging but return unauthorized
    }

    return sendProblem(reply, req, {
      status: 401,
      title: "Unauthorized",
      detail: "Missing or invalid API key",
    });
  });
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

