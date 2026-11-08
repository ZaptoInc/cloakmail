import { describe, test, expect, beforeAll, beforeEach } from "vitest";
import { env, applyD1Migrations } from "cloudflare:test";
import { createApiApp } from "../src/api";
import { storeEmail } from "../src/store";

const MIGRATIONS = [
  {
    name: "0001_init",
    queries: [
      `CREATE TABLE IF NOT EXISTS emails (
        id              TEXT PRIMARY KEY,
        address         TEXT NOT NULL,
        from_addr       TEXT NOT NULL,
        subject         TEXT NOT NULL,
        text_body       TEXT NOT NULL DEFAULT '',
        html_body       TEXT NOT NULL DEFAULT '',
        text_preview    TEXT NOT NULL DEFAULT '',
        html_preview    TEXT NOT NULL DEFAULT '',
        headers_json    TEXT NOT NULL DEFAULT '{}',
        received_at_ms  INTEGER NOT NULL,
        received_at_iso TEXT NOT NULL,
        expires_at_ms   INTEGER NOT NULL,
        has_r2          INTEGER NOT NULL DEFAULT 0,
        r2_key          TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_emails_address_received ON emails(address, received_at_ms DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_emails_expires ON emails(expires_at_ms)`,
    ],
  },
];

const app = createApiApp();

async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; json: any }> {
  const res = await app.fetch(new Request(`https://api.local${path}`, init), env);
  let json: any = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json };
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, MIGRATIONS);
});

beforeEach(async () => {
  await applyD1Migrations(env.DB, MIGRATIONS);
});

describe("GET /api/health", () => {
  test("returns the wire-compatible health shape", async () => {
    const { status, json } = await call("/api/health");
    expect(status).toBe(200);
    expect(json.status).toBe("ok");
    expect(typeof json.smtp).toBe("boolean");
    expect(json.smtp).toBe(true);
    expect(typeof json.redis).toBe("boolean");
    expect(typeof json.uptime).toBe("number");
  });
});

describe("GET /api/inbox/:address", () => {
  test("returns empty inbox for unknown address", async () => {
    const { status, json } = await call("/api/inbox/empty@example.com");
    expect(status).toBe(200);
    expect(json.emails).toEqual([]);
    expect(json.pagination.totalEmails).toBe(0);
  });

  test("returns stored emails", async () => {
    await storeEmail(env, {
      to: "list@example.com",
      from: "sender@example.com",
      subject: "Hello",
      text: "body",
      html: "",
      headers: {},
    });
    const { status, json } = await call("/api/inbox/list@example.com");
    expect(status).toBe(200);
    expect(json.emails.length).toBeGreaterThanOrEqual(1);
    expect(json.emails[0].subject).toBe("Hello");
    expect(json.pagination.totalEmails).toBeGreaterThanOrEqual(1);
  });

  test("respects page and limit query params", async () => {
    const address = "page@example.com";
    for (let i = 0; i < 3; i++) {
      await storeEmail(env, {
        to: address,
        from: "s@example.com",
        subject: `n${i}`,
        text: "",
        html: "",
        headers: {},
      });
    }
    const { status, json } = await call(`/api/inbox/${address}?page=1&limit=2`);
    expect(status).toBe(200);
    expect(json.emails).toHaveLength(2);
    expect(json.pagination.limit).toBe(2);
    expect(json.pagination.totalEmails).toBe(3);
    expect(json.pagination.totalPages).toBe(2);
    expect(json.pagination.hasMore).toBe(true);
  });

  test("clamps limit to 50", async () => {
    const { json } = await call("/api/inbox/clamp@example.com?limit=9999");
    expect(json.pagination.limit).toBe(50);
  });
});

describe("GET /api/email/:id", () => {
  test("returns the stored email", async () => {
    const id = await storeEmail(env, {
      to: "one@example.com",
      from: "sender@example.com",
      subject: "Single",
      text: "hi",
      html: "",
      headers: {},
    });
    const { status, json } = await call(`/api/email/${id}`);
    expect(status).toBe(200);
    expect(json.id).toBe(id);
    expect(json.subject).toBe("Single");
  });

  test("returns 404 for unknown id", async () => {
    const { status, json } = await call("/api/email/no-such-thing");
    expect(status).toBe(404);
    expect(json.error).toBe("Email not found");
  });
});

describe("DELETE /api/email/:id", () => {
  test("deletes a stored email", async () => {
    const id = await storeEmail(env, {
      to: "del@example.com",
      from: "sender@example.com",
      subject: "Delete me",
      text: "",
      html: "",
      headers: {},
    });
    const { status, json } = await call(`/api/email/${id}`, { method: "DELETE" });
    expect(status).toBe(200);
    expect(json.deleted).toBe(true);

    const after = await call(`/api/email/${id}`);
    expect(after.status).toBe(404);
  });

  test("returns deleted: false for unknown id", async () => {
    const { status, json } = await call("/api/email/nope", { method: "DELETE" });
    expect(status).toBe(200);
    expect(json.deleted).toBe(false);
  });
});

describe("DELETE /api/inbox/:address", () => {
  test("deletes everything for an address", async () => {
    const address = "bulk-del@example.com";
    await storeEmail(env, {
      to: address,
      from: "s@example.com",
      subject: "A",
      text: "",
      html: "",
      headers: {},
    });
    await storeEmail(env, {
      to: address,
      from: "s@example.com",
      subject: "B",
      text: "",
      html: "",
      headers: {},
    });

    const { status, json } = await call(`/api/inbox/${address}`, { method: "DELETE" });
    expect(status).toBe(200);
    expect(json.deleted).toBe(2);

    const inbox = await call(`/api/inbox/${address}`);
    expect(inbox.json.emails).toHaveLength(0);
  });
});

describe("/api/address", () => {
  const multiEnv = { ...env, DOMAINS: "a.test,b.test", DEFAULT_DOMAIN: "a.test" };

  async function post(body: unknown, targetEnv: object = multiEnv) {
    const res = await app.fetch(
      new Request("https://api.local/api/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      targetEnv,
    );
    return { status: res.status, json: (await res.json()) as any };
  }

  test("GET returns a random prefix and a configured domain", async () => {
    const { status, json } = await call("/api/address");
    expect(status).toBe(200);
    expect(json.domain).toBe("test.local");
    expect(json.prefix).toMatch(/^[a-z]+\.[a-z]+\d{1,4}$/);
    expect(json.address).toBe(`${json.prefix}@${json.domain}`);
  });

  test("POST with empty body picks both automatically", async () => {
    const { status, json } = await post("");
    expect(status).toBe(200);
    expect(["a.test", "b.test"]).toContain(json.domain);
    expect(json.prefix).toMatch(/^[a-z]+\.[a-z]+\d{1,4}$/);
  });

  test("POST with prefix only keeps it and picks a domain", async () => {
    const { status, json } = await post({ prefix: "  My.Name+tag " });
    expect(status).toBe(200);
    expect(json.prefix).toBe("my.name+tag");
    expect(["a.test", "b.test"]).toContain(json.domain);
  });

  test("POST with domain only keeps it and generates a prefix", async () => {
    const { status, json } = await post({ domain: "B.TEST" });
    expect(status).toBe(200);
    expect(json.domain).toBe("b.test");
    expect(json.address).toBe(`${json.prefix}@b.test`);
  });

  test("POST with both returns them as-is", async () => {
    const { json } = await post({ prefix: "hello", domain: "a.test" });
    expect(json).toEqual({ prefix: "hello", domain: "a.test", address: "hello@a.test" });
  });

  test("rejects an unknown domain", async () => {
    const { status, json } = await post({ domain: "evil.com" });
    expect(status).toBe(400);
    expect(json.domains).toEqual(["a.test", "b.test"]);
  });

  test.each(["a@b", "-start", "end.", "dou..ble", "x".repeat(65), "spa ce"])(
    "rejects invalid prefix %s",
    async (prefix) => {
      const { status } = await post({ prefix });
      expect(status).toBe(400);
    },
  );

  test("rejects malformed JSON and non-object bodies", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post([1])).status).toBe(400);
    expect((await post({ prefix: 42 })).status).toBe(400);
  });
});
