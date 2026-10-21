import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScanResult } from "@mergesignal/shared";
import {
  assessmentTypescriptPatch,
  buildScanPresentationBundle,
  presentCliScanSummary,
  renderCliScanSummaryText,
} from "@mergesignal/shared";
import { resolveWorktreeGitDir } from "@mergesignal/local-git";

import { runCli } from "./cli.js";
import type { runHostedLocalScan } from "./hosted/hostedScan.js";
import {
  parseLastScanPointer,
  readLastScanPointer,
  writeLastScanPointer,
} from "./lastScanPointer.js";

const exec = promisify(execFile);
const SECRET = "ms-test-api-key-value";
const PLANTED_KEY = "planted-api-key";
const PLANTED_ORIGIN = "https://evil.example";
const INTERNAL = "worker internal failure text";
const dirs: string[] = [];

type Hosted = typeof runHostedLocalScan;

function stream() {
  let text = "";
  return {
    write(chunk: string) {
      text += chunk;
      return true;
    },
    text() {
      return text;
    },
  };
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
    { cwd },
  );
  return stdout.toString();
}

async function makeRepo(name = "repo"): Promise<{
  parent: string;
  dir: string;
  head: string;
}> {
  const parent = await mkdtemp(path.join(tmpdir(), "ms-report-"));
  dirs.push(parent);
  const dir = path.join(parent, name);
  await mkdir(dir);
  await git(dir, ["init", "-q", "-b", "main"]);
  await writeFile(path.join(dir, "a.txt"), "a\n");
  await git(dir, ["add", "--", "a.txt"]);
  await git(dir, ["commit", "-q", "-m", "init"]);
  const head = (await git(dir, ["rev-parse", "HEAD"])).trim();
  return { parent, dir, head };
}

function resultFor(marker: string): ScanResult {
  return {
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    methodologyVersion: marker,
    assessment: { ...assessmentTypescriptPatch, posture: "safe" },
  };
}

function rendered(result: ScanResult, repoLabel: string): string {
  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
    decision: result.decision?.recommendation,
  });
  if (!bundle) throw new Error("fixture did not present");
  return renderCliScanSummaryText(presentCliScanSummary(bundle, { repoLabel }));
}

function doneScan(
  result: ScanResult,
  scanId: string,
  head: string,
): Awaited<ReturnType<Hosted>> {
  return {
    ok: true,
    kind: "scan",
    scanId,
    result,
    headCommit: head,
  };
}

async function execute(
  argv: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    hostedScan?: Hosted;
    analyzeImpl?: typeof import("@mergesignal/engine").analyze;
    fetchImpl?: typeof fetch;
  },
) {
  const stdout = stream();
  const stderr = stream();
  const code = await runCli(argv, {
    stdout,
    stderr,
    cwd: options.cwd,
    env: options.env ?? {},
    ...(options.hostedScan ? { hostedScan: options.hostedScan } : {}),
    analyzeImpl:
      options.analyzeImpl ??
      (async () => {
        throw new Error("in-process analyze must not run");
      }),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  return { code, stdout: stdout.text(), stderr: stderr.text() };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function pointerFile(cwd: string): Promise<string> {
  const gitDir = await resolveWorktreeGitDir({ cwd });
  if (!gitDir.ok) throw new Error(gitDir.outcome);
  return path.join(gitDir.gitDir, "mergesignal", "last-scan.json");
}

async function plantPointer(
  cwd: string,
  pointer: Record<string, unknown>,
): Promise<void> {
  const file = await pointerFile(cwd);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(pointer)}\n`);
}

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);

function validPointer(scanId = "scan-1"): Record<string, unknown> {
  return { v: 1, scanId, head: HEAD };
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("last completed scan pointer", () => {
  it("stores only the scan reference under the worktree git directory", async () => {
    const repo = await makeRepo();
    const result = resultFor("remembered");
    const hostedScan = vi.fn<Hosted>(async () =>
      doneScan(result, "scan-1", repo.head),
    );

    const ran = await execute(["scan"], {
      cwd: repo.dir,
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan,
    });

    expect(ran.code).toBe(0);
    expect(ran.stderr).toBe("");
    expect(ran.stdout).toBe(`${rendered(result, "repo")}\n`);
    expect(ran.stdout).not.toContain("Completed scan");
    const text = await readFile(await pointerFile(repo.dir), "utf8");
    expect(JSON.parse(text)).toEqual({
      v: 1,
      scanId: "scan-1",
      head: repo.head,
    });
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(result.generatedAt);
    expect(text).not.toContain("findings");
    expect(await git(repo.dir, ["status", "--porcelain"])).toBe("");
  });

  it("does not let a remembered pointer skip a later scan", async () => {
    const repo = await makeRepo();
    const first = resultFor("first");
    const second = resultFor("second");
    const third = resultFor("third");
    const results = [first, second, third];
    let calls = 0;
    const hostedScan = vi.fn<Hosted>(async () => {
      const result = results[calls]!;
      calls += 1;
      return doneScan(result, `scan-${calls}`, repo.head);
    });

    await execute(["scan"], {
      cwd: repo.dir,
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan,
    });
    await execute(["scan"], {
      cwd: repo.dir,
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan,
    });
    const json = await execute(["scan", "--json"], {
      cwd: repo.dir,
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan,
    });

    expect(hostedScan).toHaveBeenCalledTimes(3);
    expect(json.stdout).toBe(`${JSON.stringify(third)}\n`);
    expect(json.stderr).toBe("");
    expect(
      JSON.parse(await readFile(await pointerFile(repo.dir), "utf8")),
    ).toMatchObject({
      scanId: "scan-3",
    });
  });

  it("does not remember a no-op, a hosted failure, or trusted analysis", async () => {
    const repo = await makeRepo();
    await plantPointer(repo.dir, validPointer("kept"));
    const analyzeImpl = vi.fn(async () => resultFor("trusted"));

    const noop = await execute(["scan"], {
      cwd: repo.dir,
      hostedScan: async () => ({
        ok: true,
        kind: "local",
        observation: {
          ok: true,
          outcome: "no_dependency_upgrade_episode",
          repositoryRoot: repo.dir,
          headCommit: repo.head,
          baseCommit: BASE,
          mergeBaseCommit: BASE,
          changedPaths: [],
        },
      }),
    });
    const failed = await execute(["scan"], {
      cwd: repo.dir,
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan: async () => ({
        ok: false,
        kind: "hosted",
        failure: { code: "scan_failed", detail: INTERNAL },
      }),
    });
    await execute(["scan", "--json"], {
      cwd: repo.dir,
      env: { MERGESIGNAL_TRUSTED_ANALYSIS: "1" },
      analyzeImpl,
    });

    expect(noop.code).toBe(0);
    expect(failed.code).toBe(1);
    expect(failed.stderr).not.toContain(INTERNAL);
    expect(analyzeImpl).toHaveBeenCalled();
    const gitDir = await resolveWorktreeGitDir({ cwd: repo.dir });
    if (!gitDir.ok) throw new Error(gitDir.outcome);
    expect(await readLastScanPointer(gitDir.gitDir)).toEqual({
      scanId: "kept",
      head: HEAD,
    });
  });

  it("keeps a successful scan successful when the pointer cannot be saved", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "ms-report-"));
    dirs.push(parent);
    const result = resultFor("unsaved");
    const ran = await execute(["scan", "--json"], {
      cwd: parent,
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan: async () => doneScan(result, "scan-1", HEAD),
    });

    expect(ran.code).toBe(0);
    expect(ran.stdout).toBe(`${JSON.stringify(result)}\n`);
    expect(ran.stderr).toBe(
      "The completed scan could not be remembered for later report.\n",
    );
  });

  it("rejects a partial pointer and ignores a sibling temporary file", async () => {
    const repo = await makeRepo();
    const gitDir = await resolveWorktreeGitDir({ cwd: repo.dir });
    if (!gitDir.ok) throw new Error(gitDir.outcome);
    const directory = path.join(gitDir.gitDir, "mergesignal");
    await mkdir(directory);
    await writeFile(path.join(directory, "last-scan.json"), "{");
    await writeFile(
      path.join(directory, ".last-scan.json.partial.tmp"),
      JSON.stringify(validPointer("hidden")),
    );

    expect(await readLastScanPointer(gitDir.gitDir)).toBe("malformed");
    await writeLastScanPointer(gitDir.gitDir, {
      scanId: "scan-real",
      head: HEAD,
    });
    expect(await readLastScanPointer(gitDir.gitDir)).toEqual({
      scanId: "scan-real",
      head: HEAD,
    });
  });
});

describe("ms report", () => {
  it("retrieves the remembered result without another analysis", async () => {
    const repo = await makeRepo();
    const result = resultFor("reported");
    await plantPointer(repo.dir, {
      ...validPointer(),
      head: repo.head,
      origin: PLANTED_ORIGIN,
      apiKey: PLANTED_KEY,
      result: resultFor("local-cache"),
    });
    const hostedScan = vi.fn<Hosted>(async () => {
      throw new Error("scan");
    });
    const analyzeImpl = vi.fn(async () => {
      throw new Error("analyze");
    });
    const seen: { url?: string; method?: string; authorization?: string } = {};
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      seen.url = url;
      seen.method = init?.method;
      seen.authorization =
        new Headers(init?.headers).get("authorization") ?? "";
      return jsonResponse(200, {
        id: "scan-1",
        status: "done",
        detailPresentation: { reasoning: [INTERNAL] },
        error: INTERNAL,
        result,
      });
    };

    const human = await execute(["report"], {
      cwd: repo.dir,
      env: {
        MERGESIGNAL_API_KEY: SECRET,
        MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
        MERGESIGNAL_TRUSTED_ANALYSIS: "1",
      },
      hostedScan,
      analyzeImpl,
      fetchImpl,
    });
    const json = await execute(["report", "--json"], {
      cwd: repo.dir,
      env: {
        MERGESIGNAL_API_KEY: SECRET,
        MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
      },
      hostedScan,
      analyzeImpl,
      fetchImpl,
    });

    expect(hostedScan).not.toHaveBeenCalled();
    expect(analyzeImpl).not.toHaveBeenCalled();
    expect(seen.method).toBe("GET");
    expect(seen.url).toBe(
      "http://127.0.0.1:9/v1/scan/scan-1?include=rawResult",
    );
    expect(seen.authorization).toBe(`Bearer ${SECRET}`);
    expect(human.code).toBe(0);
    expect(human.stdout).toBe(
      `Completed scan\n\n${rendered(result, "repo")}\n`,
    );
    expect(human.stdout).not.toContain(INTERNAL);
    expect(human.stdout).not.toContain("detailPresentation");
    expect(json.code).toBe(0);
    expect(json.stdout).toBe(`${JSON.stringify(result)}\n`);
    expect(json.stdout).not.toContain("detailPresentation");
    expect(json.stdout).not.toContain(INTERNAL);
  });

  it("says when the remembered scan is for an earlier HEAD", async () => {
    const repo = await makeRepo();
    const result = resultFor("earlier");
    await plantPointer(repo.dir, { ...validPointer(), head: repo.head });
    await writeFile(path.join(repo.dir, "b.txt"), "b\n");
    await git(repo.dir, ["add", "--", "b.txt"]);
    await git(repo.dir, ["commit", "-q", "-m", "next"]);
    const current = (await git(repo.dir, ["rev-parse", "HEAD"])).trim();
    const ran = await execute(["report"], {
      cwd: repo.dir,
      env: {
        MERGESIGNAL_API_KEY: SECRET,
        MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
      },
      fetchImpl: async () => jsonResponse(200, { status: "done", result }),
    });

    expect(ran.code).toBe(0);
    expect(
      ran.stdout.startsWith(
        `Completed scan\nScanned HEAD ${repo.head}\nCurrent HEAD ${current}\n\n`,
      ),
    ).toBe(true);
    expect(ran.stdout).toContain(rendered(result, "repo"));
    const json = await execute(["report", "--json"], {
      cwd: repo.dir,
      env: {
        MERGESIGNAL_API_KEY: SECRET,
        MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
      },
      fetchImpl: async () => jsonResponse(200, { status: "done", result }),
    });
    expect(json.stdout).toBe(`${JSON.stringify(result)}\n`);
    expect(json.stdout).not.toContain("Scanned HEAD");
  });

  it("keeps pointers isolated across worktrees and same-named repositories", async () => {
    const main = await makeRepo("app");
    const linked = path.join(main.parent, "linked");
    await git(main.dir, ["worktree", "add", "-q", "-b", "other", linked]);
    const otherParent = await mkdtemp(path.join(tmpdir(), "ms-report-"));
    dirs.push(otherParent);
    const sameName = path.join(otherParent, "app");
    await mkdir(sameName);
    await git(sameName, ["init", "-q", "-b", "main"]);
    await writeFile(path.join(sameName, "a.txt"), "a\n");
    await git(sameName, ["add", "--", "a.txt"]);
    await git(sameName, ["commit", "-q", "-m", "init"]);
    const otherHead = (await git(sameName, ["rev-parse", "HEAD"])).trim();

    await execute(["scan"], {
      cwd: main.dir,
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan: async () =>
        doneScan(resultFor("main"), "main-scan", main.head),
    });
    await execute(["scan"], {
      cwd: linked,
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan: async () =>
        doneScan(resultFor("linked"), "linked-scan", main.head),
    });
    await execute(["scan"], {
      cwd: sameName,
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan: async () =>
        doneScan(resultFor("other"), "other-scan", otherHead),
    });

    const mainPointer = JSON.parse(
      await readFile(await pointerFile(main.dir), "utf8"),
    );
    const linkedPointer = JSON.parse(
      await readFile(await pointerFile(linked), "utf8"),
    );
    const otherPointer = JSON.parse(
      await readFile(await pointerFile(sameName), "utf8"),
    );
    expect(mainPointer.scanId).toBe("main-scan");
    expect(linkedPointer.scanId).toBe("linked-scan");
    expect(otherPointer.scanId).toBe("other-scan");
    expect(path.dirname(await pointerFile(linked))).not.toBe(
      path.dirname(await pointerFile(main.dir)),
    );
  });

  it.each([
    [
      "missing pointer",
      async (dir: string) => dir,
      "No completed scan is remembered for this worktree.",
    ],
    [
      "malformed pointer",
      async (dir: string) => {
        await plantPointer(dir, { v: 1 });
        return dir;
      },
      "The remembered scan reference is not usable.",
    ],
    [
      "missing api key",
      async (dir: string) => {
        await plantPointer(dir, validPointer());
        return dir;
      },
      "MERGESIGNAL_API_KEY is required to retrieve a hosted scan.",
    ],
  ])("fails operationally for %s", async (_name, prepare, message) => {
    const repo = await makeRepo();
    const cwd = await prepare(repo.dir);
    const env = message.startsWith("MERGESIGNAL_API_KEY")
      ? { MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9" }
      : {
          MERGESIGNAL_API_KEY: SECRET,
          MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
        };
    const ran = await execute(["report"], { cwd, env });
    expect(ran.code).toBe(1);
    expect(ran.stderr).toBe(`${message}\n`);
    expect(ran.stdout).toBe("");
    expect(`${ran.stdout}${ran.stderr}`).not.toMatch(/Assessment:/);
  });

  it("fails operationally outside a git worktree", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "ms-report-"));
    dirs.push(dir);
    const ran = await execute(["report"], {
      cwd: dir,
      env: { MERGESIGNAL_API_KEY: SECRET },
    });
    expect(ran.code).toBe(1);
    expect(ran.stderr).toBe("This directory is not a Git repository.\n");
    expect(ran.stdout).not.toMatch(/Assessment:/);
  });

  it.each([
    [401, "The API key was rejected."],
    [403, "The hosted service refused the request."],
    [404, "The hosted scan was not found."],
  ])("maps HTTP %s without an assessment", async (status, message) => {
    const repo = await makeRepo();
    await plantPointer(repo.dir, validPointer());
    const ran = await execute(["report"], {
      cwd: repo.dir,
      env: {
        MERGESIGNAL_API_KEY: SECRET,
        MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
      },
      fetchImpl: async () => jsonResponse(status, { detail: INTERNAL }),
    });
    expect(ran.code).toBe(1);
    expect(ran.stderr).toBe(`${message}\n`);
    expect(ran.stderr).not.toContain(INTERNAL);
    expect(ran.stdout).not.toMatch(/Assessment:/);
  });

  it.each([
    ["queued", "The scan is still queued."],
    ["running", "The scan is still running."],
    ["failed", "The hosted scan failed."],
  ])("rejects a %s scan", async (status, message) => {
    const repo = await makeRepo();
    await plantPointer(repo.dir, validPointer());
    const ran = await execute(["report", "--json"], {
      cwd: repo.dir,
      env: {
        MERGESIGNAL_API_KEY: SECRET,
        MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
      },
      fetchImpl: async () =>
        jsonResponse(200, { status, error: INTERNAL, detailPresentation: {} }),
    });
    expect(ran.code).toBe(1);
    const body = JSON.parse(ran.stdout);
    expect(body).toMatchObject({ kind: "cli_error", message });
    expect(ran.stdout).not.toContain(INTERNAL);
    expect(ran.stdout).not.toMatch(/Assessment:/);
  });

  it("rejects a completed scan without a usable result and a network failure", async () => {
    const repo = await makeRepo();
    await plantPointer(repo.dir, validPointer());
    const env = {
      MERGESIGNAL_API_KEY: SECRET,
      MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
    };
    const missing = await execute(["report"], {
      cwd: repo.dir,
      env,
      fetchImpl: async () => jsonResponse(200, { status: "done" }),
    });
    const network = await execute(["report"], {
      cwd: repo.dir,
      env,
      fetchImpl: async () => {
        throw new Error("socket");
      },
    });
    expect(missing.code).toBe(1);
    expect(missing.stderr).toBe(
      "The hosted scan service returned an unusable response.\n",
    );
    expect(network.code).toBe(1);
    expect(network.stderr).toBe("The hosted scan request did not complete.\n");
  });

  it("rejects scan-only options instead of applying them", async () => {
    const repo = await makeRepo();
    await plantPointer(repo.dir, validPointer());
    const ran = await execute(["report", "--fail-above", "0", "scan-1"], {
      cwd: repo.dir,
      env: { MERGESIGNAL_API_KEY: SECRET },
    });
    expect(ran.code).toBe(2);
    expect(ran.stderr).toContain("report accepts only --json");
  });

  it("rejects path and query scan ids before a request", async () => {
    const repo = await makeRepo();
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("request");
    });
    const env = {
      MERGESIGNAL_API_KEY: SECRET,
      MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
    };
    for (const scanId of ["a/b", "..", "a?b"]) {
      await plantPointer(repo.dir, { v: 1, scanId, head: HEAD });
      const ran = await execute(["report", "--json"], {
        cwd: repo.dir,
        env,
        fetchImpl,
      });
      expect(ran.code).toBe(1);
      expect(ran.stderr).toBe("");
      expect(JSON.parse(ran.stdout)).toMatchObject({
        kind: "cli_error",
        code: "malformed_scan_reference",
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retrieves a valid result when current HEAD cannot be resolved", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "ms-report-"));
    dirs.push(parent);
    const dir = path.join(parent, "repo");
    await mkdir(dir);
    await git(dir, ["init", "-q", "-b", "main"]);
    const gitDir = await resolveWorktreeGitDir({ cwd: dir });
    if (!gitDir.ok) throw new Error(gitDir.outcome);
    await writeLastScanPointer(gitDir.gitDir, { scanId: "scan-1", head: HEAD });
    const result = resultFor("unborn");
    const env = {
      MERGESIGNAL_API_KEY: SECRET,
      MERGESIGNAL_API_ORIGIN: "http://127.0.0.1:9",
    };
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(200, { status: "done", result, detailPresentation: {} });

    const human = await execute(["report"], { cwd: dir, env, fetchImpl });
    const json = await execute(["report", "--json"], {
      cwd: dir,
      env,
      fetchImpl,
    });

    expect(human.code).toBe(0);
    expect(human.stdout).toBe(
      `Completed scan\n\n${rendered(result, "repo")}\n`,
    );
    expect(human.stdout).not.toContain("Scanned HEAD");
    expect(human.stdout).not.toContain("Current HEAD");
    expect(json.code).toBe(0);
    expect(json.stdout).toBe(`${JSON.stringify(result)}\n`);
    expect(json.stdout).not.toContain("Scanned HEAD");
  });
});

describe("pointer parsing", () => {
  it("ignores planted network authority and does not accept a stored result", () => {
    const parsed = parseLastScanPointer(
      JSON.stringify({
        ...validPointer(),
        origin: PLANTED_ORIGIN,
        apiKey: PLANTED_KEY,
        authorization: `Bearer ${PLANTED_KEY}`,
        result: resultFor("stored"),
        base: BASE,
      }),
    );
    expect(parsed).toEqual({ scanId: "scan-1", head: HEAD });
    expect(parsed).not.toHaveProperty("base");
  });
});
