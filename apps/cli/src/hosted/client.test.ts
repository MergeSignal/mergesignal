import { describe, expect, it } from "vitest";

import { createHostedScanClient, POLL_GET_TIMEOUT_MS } from "./client.js";

const KEY = "test-key-should-not-leak";

describe("hosted scan client", () => {
  it("does not send the bearer token to an arbitrary origin", async () => {
    let called = false;
    const client = createHostedScanClient({
      origin: new URL("https://example.com"),
      apiKey: KEY,
      fetchImpl: async () => {
        called = true;
        return new Response(null, { status: 202 });
      },
    });

    const submitted = await client.submit(submission());

    expect(called).toBe(false);
    expect(submitted).toEqual({
      ok: false,
      failure: { code: "invalid_origin" },
    });
    expect(JSON.stringify(submitted)).not.toContain(KEY);
  });

  it("submits once and classifies entitlement separately from a transient rate limit", async () => {
    const seen: string[] = [];
    const client = createHostedScanClient({
      origin: new URL("https://mergesignal-api.fly.dev"),
      apiKey: KEY,
      fetchImpl: async (_input, init) => {
        seen.push(String(init?.method));
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Bearer ${KEY}`,
        );
        return json(429, {
          code: "entitlement_exhausted",
          limit: 10,
          used: 10,
          resetsAt: "2026-10-26T00:00:00.000Z",
        });
      },
    });

    const submitted = await client.submit(submission());
    await client.submit(submission());

    expect(seen).toEqual(["POST", "POST"]);
    expect(submitted).toEqual({
      ok: false,
      failure: {
        code: "entitlement_exhausted",
        limit: 10,
        used: 10,
        resetsAt: "2026-10-26T00:00:00.000Z",
      },
    });
  });

  it("treats a rate limit without an entitlement code as transient", async () => {
    const client = createHostedScanClient({
      origin: new URL("http://127.0.0.1:4000"),
      apiKey: KEY,
      fetchImpl: async () => json(429, { detail: "Rate limit exceeded" }),
    });

    await expect(client.poll("scan_1")).resolves.toEqual({
      ok: false,
      failure: { code: "transient" },
    });
  });

  it("does not retry a permanent poll failure inside the client", async () => {
    let calls = 0;
    const client = createHostedScanClient({
      origin: new URL("https://127.0.0.1:4000"),
      apiKey: KEY,
      fetchImpl: async () => {
        calls += 1;
        return json(401, { detail: "Missing or invalid API key" });
      },
    });

    const polled = await client.poll("scan_1");

    expect(calls).toBe(1);
    expect(polled).toEqual({ ok: false, failure: { code: "unauthorized" } });
    expect(JSON.stringify(polled)).not.toContain(KEY);
  });

  it("aborts a slow poll inside the discovery allowance", async () => {
    const client = createHostedScanClient({
      origin: new URL("https://mergesignal-api.fly.dev"),
      apiKey: KEY,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason ?? new Error("aborted"));
          });
        }),
    });
    const started = Date.now();
    const polled = await client.poll("scan_1");
    const elapsed = Date.now() - started;

    expect(polled).toEqual({ ok: false, failure: { code: "transient" } });
    expect(elapsed).toBeGreaterThanOrEqual(POLL_GET_TIMEOUT_MS - 500);
    expect(elapsed).toBeLessThan(POLL_GET_TIMEOUT_MS + 2_000);
  }, 10_000);

  it("uploads the exact bytes once and reports a settled generation", async () => {
    const bodies: Uint8Array[] = [];
    const generations: string[] = [];
    let status = 204;
    const client = createHostedScanClient({
      origin: new URL("https://[::1]:4000"),
      apiKey: KEY,
      fetchImpl: async (input, init) => {
        expect(String(input)).toBe("https://[::1]:4000/v1/scan/scan_1/object");
        const headers = new Headers(init?.headers);
        expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
        expect(headers.get("content-type")).toBe("application/octet-stream");
        expect(headers.get("x-mergesignal-object-id")).toBe("ab".repeat(20));
        generations.push(
          headers.get("x-mergesignal-acquisition-generation") ?? "",
        );
        if (init?.body instanceof Blob) {
          bodies.push(new Uint8Array(await init.body.arrayBuffer()));
        }
        const current = status;
        status = 409;
        return new Response(null, { status: current });
      },
    });
    const bytes = Uint8Array.from([0, 1, 2, 255]);

    const accepted = await client.fulfill({
      scanId: "scan_1",
      objectId: "ab".repeat(20),
      generation: "gen-1",
      bytes,
      timeoutMs: 1000,
    });
    const settled = await client.fulfill({
      scanId: "scan_1",
      objectId: "ab".repeat(20),
      generation: "gen-1",
      bytes,
      timeoutMs: 1000,
    });

    expect(accepted).toEqual({ ok: true });
    expect(settled).toEqual({ ok: false, settled: true });
    expect(generations).toEqual(["gen-1", "gen-1"]);
    expect(bodies).toHaveLength(2);
    expect(Buffer.from(bodies[0]!).equals(Buffer.from(bytes))).toBe(true);
  });

  it("keeps pending, no-pending, and an omitted acquisition field distinct", async () => {
    const objectId = "ab".repeat(20);
    const bodies = [
      {
        status: "running",
        acquisition: { pending: true, objectId, generation: "4" },
      },
      { status: "running", acquisition: { pending: false } },
      { status: "queued" },
      {
        status: "running",
        acquisition: { pending: true, objectId: "nope", generation: "4" },
      },
      { status: "running", acquisition: { pending: "yes" } },
      { status: "running", acquisition: null },
    ];
    const client = createHostedScanClient({
      origin: new URL("https://mergesignal-api.fly.dev"),
      apiKey: KEY,
      fetchImpl: async () => json(200, bodies.shift()),
    });

    await expect(client.poll("scan_1")).resolves.toEqual({
      ok: true,
      state: "pending",
      objectId,
      generation: "4",
    });
    await expect(client.poll("scan_1")).resolves.toEqual({
      ok: true,
      state: "not_pending",
    });
    await expect(client.poll("scan_1")).resolves.toEqual({
      ok: true,
      state: "unknown",
    });
    await expect(client.poll("scan_1")).resolves.toEqual({
      ok: false,
      failure: { code: "invalid_response" },
    });
    await expect(client.poll("scan_1")).resolves.toEqual({
      ok: false,
      failure: { code: "invalid_response" },
    });
    await expect(client.poll("scan_1")).resolves.toEqual({
      ok: false,
      failure: { code: "invalid_response" },
    });
  });
});

function submission() {
  return {
    local: {
      changeIntent: "change_request" as const,
      headRevision: { sha: "a".repeat(40) },
      baseRevision: { sha: "b".repeat(40) },
    },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
