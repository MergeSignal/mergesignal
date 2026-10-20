import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { readLocalObject } from "@mergesignal/local-git";

import { POLL_GET_TIMEOUT_MS } from "./client.js";
import { runHostedLocalScan } from "./hostedScan.js";

const exec = promisify(execFile);
const KEY = "test-key-should-not-leak";
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("hosted local scan pipeline", () => {
  it("keeps the trusted in-process command path unwired", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../cli.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain(
      'process.env.MERGESIGNAL_TRUSTED_ANALYSIS === "1"',
    );
    expect(source).toContain("analyze(");
    expect(source).not.toContain("runHostedLocalScan");
  });

  it("returns local preparation outcomes without calling the API", async () => {
    const fetchImpl = mustNotFetch();
    const detached = await repo();
    await commit(detached, { "a.txt": "a\n" }, "a");
    await git(detached, ["checkout", "-q", "--detach"]);
    await expect(
      runHostedLocalScan({ cwd: detached, env: authEnv(), fetchImpl }),
    ).resolves.toEqual({ ok: false, kind: "local", outcome: "base_required" });

    const dirty = await repo();
    await commit(dirty, { "a.txt": "a\n" }, "a");
    await writeFile(path.join(dirty, "a.txt"), "dirty\n");
    await expect(
      runHostedLocalScan({
        cwd: dirty,
        base: "HEAD",
        env: authEnv(),
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      kind: "local",
      outcome: "uncommitted_changes",
    });

    const source = await repo();
    await commit(source, { "a.txt": "a\n" }, "first");
    await commit(source, { "b.txt": "b\n" }, "second");
    const shallow = path.join(path.dirname(source), "shallow");
    dirs.push(shallow);
    await git(source, ["clone", "--depth", "1", "--no-local", source, shallow]);
    await expect(
      runHostedLocalScan({
        cwd: shallow,
        base: "HEAD",
        env: authEnv(),
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      kind: "local",
      outcome: "history_insufficient",
    });

    const readme = await repo();
    await commit(readme, { "README.md": "a\n" }, "base");
    await commit(readme, { "README.md": "b\n" }, "head");
    await expect(
      runHostedLocalScan({
        cwd: readme,
        base: "HEAD~1",
        env: authEnv(),
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      ok: true,
      kind: "local",
      observation: { outcome: "no_supported_dependency_change" },
    });

    const same = await repo();
    await commit(
      same,
      { "package-lock.json": npmLock({ lodash: "4.17.21" }) },
      "base",
    );
    await commit(
      same,
      { "package-lock.json": npmLock({ lodash: "4.17.21" }, true) },
      "head",
    );
    await expect(
      runHostedLocalScan({
        cwd: same,
        base: "HEAD~1",
        env: authEnv(),
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      ok: true,
      kind: "local",
      observation: { outcome: "no_dependency_upgrade_episode" },
    });
  });

  it("represents a missing key internally and does not put it in a rejected origin call", async () => {
    const ready = await readyRepo();
    const missing = await runHostedLocalScan({
      cwd: ready,
      base: "HEAD~1",
      env: {},
      fetchImpl: mustNotFetch(),
    });
    expect(missing).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "missing_api_key" },
    });

    const rejected = await runHostedLocalScan({
      cwd: ready,
      base: "HEAD~1",
      env: {
        MERGESIGNAL_API_KEY: KEY,
        MERGESIGNAL_API_ORIGIN: "https://example.com",
      },
      fetchImpl: mustNotFetch(),
    });
    expect(rejected).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "invalid_origin" },
    });
    expect(JSON.stringify(rejected)).not.toContain(KEY);
  });

  it("submits one CLI-4 local scan and does not retry creation", async () => {
    const ready = await readyRepo();
    const calls: RecordedCall[] = [];
    const result = await runHostedLocalScan({
      cwd: ready,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      fetchImpl: async (input, init) => {
        calls.push(await record(input, init));
        return json(500, { detail: "unavailable" });
      },
    });

    expect(result).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "transient" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe("https://mergesignal-api.fly.dev/v1/scan");
    expect(calls[0]?.headers.get("authorization")).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(calls[0]?.text ?? "{}") as {
      local: Record<string, unknown>;
    };
    expect(Object.keys(body)).toEqual(["local"]);
    expect(body.local.changeIntent).toBe("change_request");
    expect(body.local.changedPaths).toEqual(["package-lock.json"]);
    expect(body.local.lockfileAtHead).toMatchObject({
      manager: "npm",
      path: "package-lock.json",
    });
    expect(body.local.lockfileAtBase).toMatchObject({ manager: "npm" });
    expect(body.local).not.toHaveProperty("dependencyGraph");
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("retries only transient polls and stops on a permanent failure", async () => {
    const ready = await readyRepo();
    let polls = 0;
    const recovered = await runHostedLocalScan({
      cwd: ready,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      fetchImpl: async (input, init) => {
        if (init?.method === "POST")
          return json(202, { scanId: "scan_1", status: "queued" });
        polls += 1;
        if (polls < 3) return json(503, { detail: "unavailable" });
        return json(200, {
          status: "done",
          result: scanResult(),
        });
      },
    });
    expect(recovered).toMatchObject({
      ok: true,
      kind: "scan",
      scanId: "scan_1",
    });
    expect(polls).toBe(3);

    const deniedRepo = await readyRepo();
    let deniedPolls = 0;
    const denied = await runHostedLocalScan({
      cwd: deniedRepo,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      fetchImpl: async (_input, init) => {
        if (init?.method === "POST") {
          return json(202, { scanId: "scan_2", status: "queued" });
        }
        deniedPolls += 1;
        return json(401, { detail: "Missing or invalid API key" });
      },
    });
    expect(deniedPolls).toBe(1);
    expect(denied).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "unauthorized" },
    });

    const limited = await readyRepo();
    let limitedPolls = 0;
    const exhausted = await runHostedLocalScan({
      cwd: limited,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      fetchImpl: async (_input, init) => {
        if (init?.method === "POST") {
          return json(202, { scanId: "scan_3", status: "queued" });
        }
        limitedPolls += 1;
        return json(429, {
          code: "entitlement_exhausted",
          limit: 10,
          used: 10,
          resetsAt: "2026-10-26T00:00:00.000Z",
        });
      },
    });
    expect(limitedPolls).toBe(1);
    expect(exhausted).toMatchObject({
      ok: false,
      kind: "hosted",
      failure: { code: "entitlement_exhausted", limit: 10, used: 10 },
    });
  });

  it("fulfills commit, tree, and blob bytes, then returns the hosted result", async () => {
    const ready = await readyRepo();
    const commitId = (await git(ready, ["rev-parse", "HEAD"])).trim();
    const treeId = (await git(ready, ["rev-parse", "HEAD^{tree}"])).trim();
    const blobId = (
      await git(ready, ["rev-parse", "HEAD:package-lock.json"])
    ).trim();
    const pending = [commitId, treeId, blobId];
    const uploads: Array<{
      id: string;
      generation: string;
      bytes: Uint8Array;
    }> = [];
    let polls = 0;
    const result = await runHostedLocalScan({
      cwd: ready,
      base: "HEAD~1",
      env: { ...authEnv(), MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:4000" },
      clock: virtualClock(),
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          return json(202, { scanId: "scan_ok", status: "queued" });
        }
        if (init?.method === "POST") {
          const headers = new Headers(init.headers);
          uploads.push({
            id: headers.get("x-mergesignal-object-id") ?? "",
            generation:
              headers.get("x-mergesignal-acquisition-generation") ?? "",
            bytes:
              init.body instanceof Blob
                ? new Uint8Array(await init.body.arrayBuffer())
                : new Uint8Array(),
          });
          return new Response(null, { status: 204 });
        }
        polls += 1;
        const objectId = pending.shift();
        if (objectId) {
          return json(200, {
            status: "running",
            acquisition: {
              pending: true,
              objectId,
              generation: `gen-${polls}`,
            },
          });
        }
        return json(200, { status: "done", result: scanResult() });
      },
    });

    expect(result).toMatchObject({
      ok: true,
      kind: "scan",
      scanId: "scan_ok",
      result: scanResult(),
    });
    expect(uploads.map((upload) => [upload.id, upload.generation])).toEqual([
      [commitId, "gen-1"],
      [treeId, "gen-2"],
      [blobId, "gen-3"],
    ]);
    expect(gitObjectHash("commit", uploads[0]!.bytes)).toBe(commitId);
    expect(gitObjectHash("tree", uploads[1]!.bytes)).toBe(treeId);
    expect(uploads[1]!.bytes.includes(0)).toBe(true);
    expect(gitObjectHash("blob", uploads[2]!.bytes)).toBe(blobId);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("does not upload a settled, missing, oversized, or expired object again", async () => {
    const ready = await readyRepo();
    const blobId = (
      await git(ready, ["rev-parse", "HEAD:package-lock.json"])
    ).trim();
    let posts = 0;
    let polls = 0;
    const settled = await runHostedLocalScan({
      cwd: ready,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          return json(202, { scanId: "scan_409", status: "queued" });
        }
        if (init?.method === "POST") {
          posts += 1;
          return new Response(null, { status: 409 });
        }
        polls += 1;
        if (polls === 1) {
          return json(200, {
            status: "running",
            acquisition: {
              pending: true,
              objectId: blobId,
              generation: "same-gen",
            },
          });
        }
        return json(200, { status: "done", result: scanResult() });
      },
    });
    expect(settled).toMatchObject({ ok: true, kind: "scan" });
    expect(posts).toBe(1);

    const missing = await readyRepo();
    let missingPosts = 0;
    const missingResult = await runHostedLocalScan({
      cwd: missing,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          return json(202, { scanId: "scan_missing", status: "queued" });
        }
        if (init?.method === "POST") missingPosts += 1;
        return json(200, {
          status: "running",
          acquisition: {
            pending: true,
            objectId: "d".repeat(40),
            generation: "missing-gen",
          },
        });
      },
    });
    expect(missingPosts).toBe(0);
    expect(missingResult).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "object_unavailable" },
    });

    const huge = await repo();
    await commit(
      huge,
      { "package-lock.json": npmLock({ lodash: "4.17.20" }) },
      "base",
    );
    await writeFile(
      path.join(huge, "package-lock.json"),
      npmLock({ lodash: "4.17.21" }),
    );
    await writeFile(path.join(huge, "big.bin"), Buffer.alloc(500_001, 7));
    await git(huge, ["add", "--", "package-lock.json", "big.bin"]);
    await git(huge, ["commit", "-q", "-m", "head"]);
    const bigId = (await git(huge, ["rev-parse", "HEAD:big.bin"])).trim();
    let hugePosts = 0;
    const oversized = await runHostedLocalScan({
      cwd: huge,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          return json(202, { scanId: "scan_big", status: "queued" });
        }
        if (init?.method === "POST") hugePosts += 1;
        return json(200, {
          status: "running",
          acquisition: {
            pending: true,
            objectId: bigId,
            generation: "big-gen",
          },
        });
      },
    });
    expect(hugePosts).toBe(0);
    expect(oversized).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "object_oversized", size: 500_001 },
    });

    const expiredRepo = await readyRepo();
    const expiredBlob = (
      await git(expiredRepo, ["rev-parse", "HEAD:package-lock.json"])
    ).trim();
    let time = 0;
    let expiredPosts = 0;
    let expiredPolls = 0;
    const expired = await runHostedLocalScan({
      cwd: expiredRepo,
      base: "HEAD~1",
      env: authEnv(),
      clock: {
        now: () => time,
        sleep: async (ms) => {
          time += ms;
        },
      },
      readObject: async (request) => {
        time = 20_000;
        return readLocalObject(request);
      },
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          return json(202, { scanId: "scan_late", status: "queued" });
        }
        if (init?.method === "POST") {
          expiredPosts += 1;
          return new Response(null, { status: 204 });
        }
        expiredPolls += 1;
        if (expiredPolls === 1) {
          return json(200, {
            status: "running",
            acquisition: {
              pending: true,
              objectId: expiredBlob,
              generation: "late-gen",
            },
          });
        }
        return json(200, { status: "done", result: scanResult() });
      },
    });
    expect(expiredPosts).toBe(0);
    expect(expired).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "fulfillment_expired" },
    });
  });

  it("stops after three transient polls and at the stale-scan horizon", async () => {
    const flaky = await readyRepo();
    let polls = 0;
    const stopped = await runHostedLocalScan({
      cwd: flaky,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      fetchImpl: async (_input, init) => {
        if (init?.method === "POST") {
          return json(202, { scanId: "scan_flaky", status: "queued" });
        }
        polls += 1;
        return json(503, { detail: "unavailable" });
      },
    });
    expect(polls).toBe(3);
    expect(stopped).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "transient" },
    });

    const waiting = await readyRepo();
    let time = 0;
    const timedOut = await runHostedLocalScan({
      cwd: waiting,
      base: "HEAD~1",
      env: authEnv(),
      clock: {
        now: () => time,
        sleep: async (ms) => {
          time += ms;
        },
      },
      fetchImpl: async (_input, init) => {
        if (init?.method === "POST") {
          return json(202, { scanId: "scan_wait", status: "queued" });
        }
        return json(200, { status: "queued" });
      },
    });
    expect(time).toBe(30 * 60 * 1000);
    expect(timedOut).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "scan_timed_out" },
    });
  });

  it("keeps discovery and fulfillment inside the server window", async () => {
    const ready = await readyRepo();
    const objectId = "ab".repeat(20);
    const promptTimeouts = spyAbortTimeouts();
    let promptUploaded = false;
    let promptUploadTimeout = 0;
    let prompt: Awaited<ReturnType<typeof runHostedLocalScan>>;
    try {
      prompt = await runHostedLocalScan({
        cwd: ready,
        base: "HEAD~1",
        env: authEnv(),
        clock: virtualClock(),
        readObject: async () => ({
          kind: "bytes",
          type: "blob",
          size: 1,
          bytes: Uint8Array.of(1),
        }),
        fetchImpl: async (input, init) => {
          if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
            return json(202, { scanId: "scan_prompt", status: "queued" });
          }
          if (init?.method === "POST") {
            promptUploaded = true;
            promptUploadTimeout = promptTimeouts.values.at(-1) ?? 0;
            return new Response(null, { status: 204 });
          }
          if (promptUploaded)
            return json(200, { status: "done", result: scanResult() });
          return json(200, {
            status: "running",
            acquisition: { pending: true, objectId, generation: "prompt-gen" },
          });
        },
      });
    } finally {
      promptTimeouts.restore();
    }
    expect(prompt).toMatchObject({ ok: true, kind: "scan" });
    expect(promptUploadTimeout).toBe(19_900);

    const discovered = await readyRepo();
    let time = 0;
    let discoverGets = 0;
    let discoverUploaded = false;
    let discoverUploadTimeout = 0;
    const discoverTimeouts = spyAbortTimeouts();
    let reduced: Awaited<ReturnType<typeof runHostedLocalScan>>;
    try {
      reduced = await runHostedLocalScan({
        cwd: discovered,
        base: "HEAD~1",
        env: authEnv(),
        clock: {
          now: () => time,
          sleep: async (ms) => {
            time += ms;
          },
        },
        readObject: async (request) => {
          expect(request.timeoutMs).toBe(14_900);
          return {
            kind: "bytes" as const,
            type: "blob" as const,
            size: 1,
            bytes: Uint8Array.of(1),
          };
        },
        fetchImpl: async (input, init) => {
          if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
            return json(202, { scanId: "scan_discover", status: "queued" });
          }
          if (init?.method === "POST") {
            discoverUploaded = true;
            discoverUploadTimeout = discoverTimeouts.values.at(-1) ?? 0;
            return new Response(null, { status: 204 });
          }
          if (discoverUploaded) {
            return json(200, { status: "done", result: scanResult() });
          }
          discoverGets += 1;
          if (discoverGets === 1) return json(200, { status: "queued" });
          time += POLL_GET_TIMEOUT_MS;
          return json(200, {
            status: "running",
            acquisition: { pending: true, objectId, generation: "late-get" },
          });
        },
      });
    } finally {
      discoverTimeouts.restore();
    }
    expect(reduced).toMatchObject({ ok: true, kind: "scan" });
    expect(discoverUploadTimeout).toBe(14_900);

    const slow = await readyRepo();
    let slowTime = 0;
    let slowPosts = 0;
    const slowResult = await runHostedLocalScan({
      cwd: slow,
      base: "HEAD~1",
      env: authEnv(),
      clock: {
        now: () => slowTime,
        sleep: async (ms) => {
          slowTime += ms;
        },
      },
      readObject: async (request) => {
        slowTime += request.timeoutMs ?? 0;
        return {
          kind: "bytes" as const,
          type: "blob" as const,
          size: 1,
          bytes: Uint8Array.of(1),
        };
      },
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          slowTime += 6_000;
          return json(202, { scanId: "scan_slow_git", status: "queued" });
        }
        if (init?.method === "POST") {
          slowPosts += 1;
          return new Response(null, { status: 204 });
        }
        slowTime += POLL_GET_TIMEOUT_MS;
        return json(200, {
          status: "running",
          acquisition: { pending: true, objectId, generation: "slow-git" },
        });
      },
    });
    expect(slowPosts).toBe(0);
    expect(slowResult).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "fulfillment_expired" },
    });
  });

  it("anchors the deadline to submit start while creation is still in flight", async () => {
    const ready = await readyRepo();
    let time = 0;
    const timeouts = spyAbortTimeouts();
    let uploadTimeout = 0;
    try {
      const result = await runHostedLocalScan({
        cwd: ready,
        base: "HEAD~1",
        env: authEnv(),
        clock: clockOf(
          () => time,
          (ms) => {
            time += ms;
          },
        ),
        readObject: instantBytes,
        fetchImpl: async (input, init) => {
          if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
            time += 3_000;
            return json(202, { scanId: "scan_submit", status: "queued" });
          }
          if (init?.method === "POST") {
            uploadTimeout = timeouts.values.at(-1) ?? 0;
            return new Response(null, { status: 204 });
          }
          if (uploadTimeout > 0) {
            return json(200, { status: "done", result: scanResult() });
          }
          return pendingBody("ab".repeat(20), "4");
        },
      });
      expect(result).toMatchObject({ ok: true, kind: "scan" });
      expect(uploadTimeout).toBe(16_900);
    } finally {
      timeouts.restore();
    }
  });

  it("advances the anchor only on an authoritative no-pending poll", async () => {
    const ready = await readyRepo();
    let time = 0;
    let polls = 0;
    const timeouts = spyAbortTimeouts();
    let uploadTimeout = 0;
    try {
      const result = await runHostedLocalScan({
        cwd: ready,
        base: "HEAD~1",
        env: authEnv(),
        clock: clockOf(
          () => time,
          (ms) => {
            time += ms;
          },
        ),
        readObject: instantBytes,
        fetchImpl: async (input, init) => {
          if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
            time += 5_000;
            return json(202, { scanId: "scan_clear", status: "queued" });
          }
          if (init?.method === "POST") {
            uploadTimeout = timeouts.values.at(-1) ?? 0;
            return new Response(null, { status: 204 });
          }
          if (uploadTimeout > 0) {
            return json(200, { status: "done", result: scanResult() });
          }
          polls += 1;
          if (polls === 1) {
            return json(200, {
              status: "running",
              acquisition: { pending: false },
            });
          }
          return pendingBody("ab".repeat(20), "4");
        },
      });
      expect(result).toMatchObject({ ok: true, kind: "scan" });
      expect(uploadTimeout).toBe(18_900);
    } finally {
      timeouts.restore();
    }
  });

  it("does not advance the anchor when acquisition is omitted or the poll fails", async () => {
    const omitted = await readyRepo();
    let omittedTime = 0;
    let omittedPolls = 0;
    const omittedTimeouts = spyAbortTimeouts();
    let omittedUpload = 0;
    try {
      await runHostedLocalScan({
        cwd: omitted,
        base: "HEAD~1",
        env: authEnv(),
        clock: clockOf(
          () => omittedTime,
          (ms) => {
            omittedTime += ms;
          },
        ),
        readObject: instantBytes,
        fetchImpl: async (input, init) => {
          if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
            omittedTime += 5_000;
            return json(202, { scanId: "scan_omit", status: "queued" });
          }
          if (init?.method === "POST") {
            omittedUpload = omittedTimeouts.values.at(-1) ?? 0;
            return new Response(null, { status: 204 });
          }
          if (omittedUpload > 0) {
            return json(200, { status: "done", result: scanResult() });
          }
          omittedPolls += 1;
          if (omittedPolls === 1) return json(200, { status: "running" });
          return pendingBody("ab".repeat(20), "4");
        },
      });
      expect(omittedUpload).toBe(13_900);
    } finally {
      omittedTimeouts.restore();
    }

    const flaky = await readyRepo();
    let flakyTime = 0;
    let flakyPolls = 0;
    const flakyTimeouts = spyAbortTimeouts();
    let flakyUpload = 0;
    try {
      await runHostedLocalScan({
        cwd: flaky,
        base: "HEAD~1",
        env: authEnv(),
        clock: clockOf(
          () => flakyTime,
          (ms) => {
            flakyTime += ms;
          },
        ),
        readObject: instantBytes,
        fetchImpl: async (input, init) => {
          if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
            flakyTime += 2_000;
            return json(202, {
              scanId: "scan_transient_anchor",
              status: "queued",
            });
          }
          if (init?.method === "POST") {
            flakyUpload = flakyTimeouts.values.at(-1) ?? 0;
            return new Response(null, { status: 204 });
          }
          if (flakyUpload > 0) {
            return json(200, { status: "done", result: scanResult() });
          }
          flakyPolls += 1;
          if (flakyPolls === 1) return json(503, { detail: "unavailable" });
          return pendingBody("ab".repeat(20), "4");
        },
      });
      expect(flakyUpload).toBe(16_900);
    } finally {
      flakyTimeouts.restore();
    }
  });

  it("moves the anchor to upload start after 204 and leaves it after 409", async () => {
    const accepted = await readyRepo();
    let acceptedTime = 0;
    let acceptedReads = 0;
    const acceptedTimeouts = spyAbortTimeouts();
    const acceptedUploads: number[] = [];
    try {
      const result = await runHostedLocalScan({
        cwd: accepted,
        base: "HEAD~1",
        env: authEnv(),
        clock: clockOf(
          () => acceptedTime,
          (ms) => {
            acceptedTime += ms;
          },
        ),
        readObject: async () => {
          acceptedReads += 1;
          if (acceptedReads === 1) acceptedTime += 2_000;
          return instantBytes();
        },
        fetchImpl: async (input, init) => {
          if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
            return json(202, { scanId: "scan_204_anchor", status: "queued" });
          }
          if (init?.method === "POST") {
            acceptedUploads.push(acceptedTimeouts.values.at(-1) ?? 0);
            return new Response(null, { status: 204 });
          }
          if (acceptedUploads.length >= 2) {
            return json(200, { status: "done", result: scanResult() });
          }
          const objectId =
            acceptedUploads.length === 0 ? "aa".repeat(20) : "bb".repeat(20);
          return pendingBody(objectId, "4");
        },
      });
      expect(result).toMatchObject({ ok: true, kind: "scan" });
      expect(acceptedUploads[1]).toBe(19_900);
    } finally {
      acceptedTimeouts.restore();
    }

    const rejected = await readyRepo();
    let rejectedTime = 0;
    let rejectedReads = 0;
    const rejectedTimeouts = spyAbortTimeouts();
    const rejectedUploads: number[] = [];
    try {
      const result = await runHostedLocalScan({
        cwd: rejected,
        base: "HEAD~1",
        env: authEnv(),
        clock: clockOf(
          () => rejectedTime,
          (ms) => {
            rejectedTime += ms;
          },
        ),
        readObject: async () => {
          rejectedReads += 1;
          if (rejectedReads === 1) rejectedTime += 5_000;
          return instantBytes();
        },
        fetchImpl: async (input, init) => {
          if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
            return json(202, { scanId: "scan_409_anchor", status: "queued" });
          }
          if (init?.method === "POST") {
            rejectedUploads.push(rejectedTimeouts.values.at(-1) ?? 0);
            return new Response(null, {
              status: rejectedUploads.length === 1 ? 409 : 204,
            });
          }
          if (rejectedUploads.length >= 2) {
            return json(200, { status: "done", result: scanResult() });
          }
          const objectId =
            rejectedUploads.length === 0 ? "aa".repeat(20) : "bb".repeat(20);
          return pendingBody(objectId, "4");
        },
      });
      expect(result).toMatchObject({ ok: true, kind: "scan" });
      expect(rejectedUploads).toHaveLength(2);
      expect(rejectedUploads[1]).toBe(13_900);
    } finally {
      rejectedTimeouts.restore();
    }
  });

  it("does not advance the anchor when the object upload fails in transit", async () => {
    const ready = await readyRepo();
    let posts = 0;
    const result = await runHostedLocalScan({
      cwd: ready,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      readObject: instantBytes,
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          return json(202, { scanId: "scan_upload_lost", status: "queued" });
        }
        if (init?.method === "POST") {
          posts += 1;
          throw new Error("socket hang up");
        }
        return pendingBody("ab".repeat(20), "4");
      },
    });
    expect(posts).toBe(1);
    expect(result).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "transient" },
    });
    expect(JSON.stringify(result)).not.toContain("socket hang up");
  });

  it("uses the authoritative no-pending poll start as the blind-tail anchor", async () => {
    const clear = await readyRepo();
    let clearTime = 0;
    let clearPolls = 0;
    const clearBudgets: number[] = [];
    const clearResult = await runHostedLocalScan({
      cwd: clear,
      base: "HEAD~1",
      env: authEnv(),
      clock: clockOf(
        () => clearTime,
        (ms) => {
          clearTime += ms;
        },
      ),
      readObject: async (request) => {
        clearBudgets.push(request.timeoutMs ?? 0);
        clearTime += request.timeoutMs ?? 0;
        return instantBytes();
      },
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          return json(202, { scanId: "scan_blind_clear", status: "queued" });
        }
        if (init?.method === "POST") return new Response(null, { status: 204 });
        clearPolls += 1;
        if (clearPolls === 1) {
          clearTime += POLL_GET_TIMEOUT_MS;
          return json(200, {
            status: "running",
            acquisition: { pending: false },
          });
        }
        return pendingBody("ab".repeat(20), "4");
      },
    });
    expect(clearBudgets).toEqual([14_900]);
    expect(clearResult).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "fulfillment_expired" },
    });

    const ambiguous = await readyRepo();
    let ambiguousTime = 0;
    let ambiguousPolls = 0;
    const ambiguousBudgets: number[] = [];
    const ambiguousResult = await runHostedLocalScan({
      cwd: ambiguous,
      base: "HEAD~1",
      env: authEnv(),
      clock: clockOf(
        () => ambiguousTime,
        (ms) => {
          ambiguousTime += ms;
        },
      ),
      readObject: async (request) => {
        ambiguousBudgets.push(request.timeoutMs ?? 0);
        ambiguousTime += request.timeoutMs ?? 0;
        return instantBytes();
      },
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          ambiguousTime += 1_000;
          return json(202, { scanId: "scan_blind_unknown", status: "queued" });
        }
        if (init?.method === "POST") return new Response(null, { status: 204 });
        ambiguousPolls += 1;
        if (ambiguousPolls === 1) {
          ambiguousTime += POLL_GET_TIMEOUT_MS;
          return json(200, { status: "running" });
        }
        return pendingBody("ab".repeat(20), "4");
      },
    });
    expect(ambiguousBudgets).toEqual([13_900]);
    expect(ambiguousResult).toEqual({
      ok: false,
      kind: "hosted",
      failure: { code: "fulfillment_expired" },
    });
  });

  it("fulfills later objects under one generation, including a repeated object", async () => {
    const ready = await readyRepo();
    const uploaded: string[] = [];
    let polls = 0;
    const sequence = ["aa".repeat(20), "bb".repeat(20), "aa".repeat(20)];
    const result = await runHostedLocalScan({
      cwd: ready,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      readObject: instantBytes,
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          return json(202, { scanId: "scan_multi", status: "queued" });
        }
        if (init?.method === "POST") {
          uploaded.push(
            new Headers(init.headers).get("x-mergesignal-object-id") ?? "",
          );
          return new Response(null, { status: 204 });
        }
        const objectId = sequence[polls];
        polls += 1;
        if (!objectId)
          return json(200, { status: "done", result: scanResult() });
        return pendingBody(objectId, "4");
      },
    });
    expect(result).toMatchObject({ ok: true, kind: "scan" });
    expect(uploaded).toEqual(sequence);
  });

  it("fulfills the next same-generation object after a 409", async () => {
    const ready = await readyRepo();
    const uploaded: string[] = [];
    let polls = 0;
    const result = await runHostedLocalScan({
      cwd: ready,
      base: "HEAD~1",
      env: authEnv(),
      clock: virtualClock(),
      readObject: instantBytes,
      fetchImpl: async (input, init) => {
        if (init?.method === "POST" && String(input).endsWith("/v1/scan")) {
          return json(202, { scanId: "scan_409_next", status: "queued" });
        }
        if (init?.method === "POST") {
          const objectId =
            new Headers(init.headers).get("x-mergesignal-object-id") ?? "";
          uploaded.push(objectId);
          return new Response(null, {
            status: objectId.startsWith("aa") ? 409 : 204,
          });
        }
        polls += 1;
        if (polls === 1) return pendingBody("aa".repeat(20), "4");
        if (polls === 2) return pendingBody("bb".repeat(20), "4");
        return json(200, { status: "done", result: scanResult() });
      },
    });
    expect(result).toMatchObject({ ok: true, kind: "scan" });
    expect(uploaded).toEqual(["aa".repeat(20), "bb".repeat(20)]);
  });
});

function clockOf(
  now: () => number,
  add: (ms: number) => void,
): { now(): number; sleep(ms: number): Promise<void> } {
  return {
    now,
    sleep: async (ms) => {
      add(ms);
    },
  };
}

async function instantBytes(): Promise<{
  kind: "bytes";
  type: "blob";
  size: number;
  bytes: Uint8Array;
}> {
  return { kind: "bytes", type: "blob", size: 1, bytes: Uint8Array.of(1) };
}

function pendingBody(objectId: string, generation: string): Response {
  return json(200, {
    status: "running",
    acquisition: { pending: true, objectId, generation },
  });
}

function spyAbortTimeouts(): { values: number[]; restore(): void } {
  const values: number[] = [];
  const original = AbortSignal.timeout;
  AbortSignal.timeout = ((milliseconds: number) => {
    values.push(milliseconds);
    return original.call(AbortSignal, milliseconds);
  }) as typeof AbortSignal.timeout;
  return {
    values,
    restore() {
      AbortSignal.timeout = original;
    },
  };
}

type RecordedCall = {
  url: string;
  method: string;
  headers: Headers;
  text: string;
};

function authEnv(): NodeJS.ProcessEnv {
  return { MERGESIGNAL_API_KEY: KEY };
}

function virtualClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
  };
}

function mustNotFetch(): typeof fetch {
  return async () => {
    throw new Error("fetch should not be called");
  };
}

function scanResult() {
  return { findings: [], generatedAt: "2026-10-20T00:00:00.000Z" };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function record(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<RecordedCall> {
  const text =
    typeof init?.body === "string"
      ? init.body
      : init?.body instanceof Uint8Array
        ? Buffer.from(init.body).toString("utf8")
        : "";
  return {
    url: input instanceof URL ? input.toString() : String(input),
    method: init?.method ?? "GET",
    headers: new Headers(init?.headers),
    text,
  };
}

function gitObjectHash(type: string, bytes: Uint8Array): string {
  return createHash("sha1")
    .update(`${type} ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
}

async function repo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "ms-hosted-scan-"));
  dirs.push(dir);
  await git(dir, ["init", "-q", "-b", "main"]);
  return dir;
}

async function readyRepo(): Promise<string> {
  const dir = await repo();
  await commit(
    dir,
    { "package-lock.json": npmLock({ lodash: "4.17.20" }) },
    "base",
  );
  await commit(
    dir,
    { "package-lock.json": npmLock({ lodash: "4.17.21" }) },
    "head",
  );
  return dir;
}

async function commit(
  cwd: string,
  files: Record<string, string>,
  message: string,
): Promise<void> {
  for (const [name, contents] of Object.entries(files)) {
    const full = path.join(cwd, name);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, contents);
    await git(cwd, ["add", "--", name]);
  }
  await git(cwd, ["commit", "-q", "-m", message]);
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec(
    "git",
    [
      "-c",
      "user.email=test@example.com",
      "-c",
      "user.name=Test",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, maxBuffer: 10 * 1024 * 1024 },
  );
  return Buffer.from(stdout).toString("utf8");
}

function npmLock(packages: Record<string, string>, pretty = false): string {
  const body = {
    lockfileVersion: 3,
    packages: {
      "": { name: "app" },
      ...Object.fromEntries(
        Object.entries(packages).map(([name, version]) => [
          `node_modules/${name}`,
          { version },
        ]),
      ),
    },
  };
  return pretty ? JSON.stringify(body, null, 2) : JSON.stringify(body);
}
