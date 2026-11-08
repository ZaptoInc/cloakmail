import { getDomains, getDefaultDomain } from "./config";
import { Hono, type Context } from "hono";
import type { Env } from "./types";
import { generateRandomPrefix, isValidPrefix, randomInt } from "./utils/prefix";
import {
  deleteEmail,
  deleteInbox,
  getEmail,
  getInbox,
  isHealthy,
} from "./store";

/**
 * Captured at module load (per-isolate) so we can report a Worker uptime
 * that's compatible with the Docker server's `process.uptime()` field.
 * The number resets per cold start, which is the closest analog Workers
 * can offer.
 */
const BOOT_TIME_MS = Date.now();

/**
 * The Hono app exposes the same five routes as the Elysia API in
 * `packages/server/src/api.ts`. Path, method, params, query, and response
 * shapes match 1:1 so the existing OpenAPI types in
 * `packages/web/src/lib/types/api.d.ts` keep working without regeneration.
 */
export function createApiApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  // List available email domains
  app.get("/api/domains", (c) => {
    const domains = getDomains(c.env);
    const defaultDomain = getDefaultDomain(c.env);

    return c.json({
      domains,
      defaultDomain,
    });
  });

  // Génère une adresse. En POST, `prefix` et/ou `domain` peuvent être imposés
  // dans le corps JSON ; ce qui manque est choisi automatiquement
  // (prefix aléatoire, domaine tiré au hasard parmi les domaines configurés).
  const generateAddress = async (c: Context<{ Bindings: Env }>) => {
    let body: { prefix?: unknown; domain?: unknown } = {};

    if (c.req.method === "POST") {
      const raw = await c.req.text();
      if (raw.trim()) {
        try {
          body = JSON.parse(raw);
        } catch {
          return c.json({ error: "Invalid JSON body" }, 400);
        }
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          return c.json({ error: "Body must be a JSON object" }, 400);
        }
      }
    }

    const domains = getDomains(c.env);

    let domain: string;
    if (body.domain === undefined || body.domain === null || body.domain === "") {
      domain = domains[randomInt(domains.length)];
    } else if (typeof body.domain !== "string") {
      return c.json({ error: "domain must be a string" }, 400);
    } else {
      domain = body.domain.trim().toLowerCase();
      if (!domains.includes(domain)) {
        return c.json({ error: "Unknown domain", domains }, 400);
      }
    }

    let prefix: string;
    if (body.prefix === undefined || body.prefix === null || body.prefix === "") {
      prefix = generateRandomPrefix();
    } else if (typeof body.prefix !== "string") {
      return c.json({ error: "prefix must be a string" }, 400);
    } else {
      prefix = body.prefix.trim().toLowerCase();
      if (!isValidPrefix(prefix)) {
        return c.json({ error: "Invalid prefix" }, 400);
      }
    }

    return c.json({ prefix, domain, address: `${prefix}@${domain}` });
  };

  app.get("/api/address", generateAddress);
  app.post("/api/address", generateAddress);

  app.get("/api/inbox/:address", async (c) => {
    const address = c.req.param("address");
    const page = Number(c.req.query("page")) || 1;
    const limit = Math.min(Number(c.req.query("limit")) || 10, 50);
    const result = await getInbox(c.env, address, page, limit);
    return c.json(result);
  });

  app.get("/api/email/:id", async (c) => {
    const id = c.req.param("id");
    const email = await getEmail(c.env, id);
    if (!email) {
      return c.json({ error: "Email not found" }, 404);
    }
    return c.json(email);
  });

  app.delete("/api/inbox/:address", async (c) => {
    const address = c.req.param("address");
    const result = await deleteInbox(c.env, address);
    return c.json(result);
  });

  app.delete("/api/email/:id", async (c) => {
    const id = c.req.param("id");
    const result = await deleteEmail(c.env, id);
    return c.json(result);
  });

  app.get("/api/health", async (c) => {
    // Workers don't have a long-lived SMTP server or `process.uptime()`,
    // so we shim those fields:
    //   - smtp: true — having an `email` export means Email Routing is
    //     hooked up; from the wire's perspective that's "SMTP running".
    //   - redis: storage backend (D1 + R2) reachable. Field name preserved
    //     for compatibility with the Docker server's wire format.
    //   - uptime: seconds since this isolate booted.
    const storageOk = await isHealthy(c.env);
    return c.json({
      status: "ok",
      smtp: true,
      redis: storageOk,
      uptime: (Date.now() - BOOT_TIME_MS) / 1000,
    });
  });

  return app;
}

/**
 * A pre-built default instance for `worker.ts` to delegate to. Tests can
 * still call `createApiApp()` directly to get a fresh instance per test.
 */
export const apiApp = createApiApp();
