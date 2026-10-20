import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ScanResult } from "@mergesignal/shared";
import {
  assessmentTypescriptPatch,
  buildScanPresentationBundle,
  presentCliScanSummary,
  renderCliScanSummaryText,
} from "@mergesignal/shared";

import type { runHostedLocalScan } from "./hosted/hostedScan.js";
import { runCli } from "./cli.js";

const SECRET = "ms-test-api-key-value";

type Hosted = typeof runHostedLocalScan;
type Pipeline = Awaited<ReturnType<Hosted>>;

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

async function execute(
  argv: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    hostedScan?: Hosted;
    analyzeImpl?: typeof import("@mergesignal/engine").analyze;
    signal?: AbortSignal;
  } = {},
) {
  const stdout = stream();
  const stderr = stream();
  const code = await runCli(argv, {
    stdout,
    stderr,
    env: options.env ?? {},
    cwd: options.cwd ?? "/tmp/cli-contract",
    ...(options.hostedScan ? { hostedScan: options.hostedScan } : {}),
    analyzeImpl:
      options.analyzeImpl ??
      (async () => {
        throw new Error("in-process analyze must not run");
      }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return { code, stdout: stdout.text(), stderr: stderr.text() };
}

function noop(
  outcome: "no_supported_dependency_change" | "no_dependency_upgrade_episode",
): Pipeline {
  return {
    ok: true,
    kind: "local",
    observation: {
      ok: true,
      outcome,
      repositoryRoot: "/repo",
      headCommit: "a".repeat(40),
      baseCommit: "b".repeat(40),
      mergeBaseCommit: "b".repeat(40),
      changedPaths: [],
    },
  };
}

function completed(
  posture: "safe" | "needs_review" | "risky" | "indeterminate",
  score?: number,
): ScanResult {
  return {
    findings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    methodologyVersion: "cli-contract-test",
    assessment: { ...assessmentTypescriptPatch, posture },
    ...(score === undefined
      ? {}
      : {
          prRisk: {
            availability: "scored" as const,
            score,
            layerScores: {
              security: score,
              maintainability: score,
              ecosystem: score,
              upgradeImpact: score,
            },
          },
        }),
  };
}

function expectOnlyJson(stdout: string, stderr: string, value: unknown) {
  expect(stderr).toBe("");
  expect(stdout).toBe(`${JSON.stringify(value)}\n`);
}

describe("normal CLI contract", () => {
  it("sends a ready scan to the hosted pipeline and returns the raw result", async () => {
    const result = completed("safe", 12);
    const analyzeImpl = vi.fn(async () => {
      throw new Error("analyze");
    });
    const hostedScan = vi.fn<Hosted>(async () => ({
      ok: true,
      kind: "scan",
      scanId: "scan-1",
      result,
    }));

    const ran = await execute(["scan", "--json"], {
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan,
      analyzeImpl,
    });

    expect(analyzeImpl).not.toHaveBeenCalled();
    expect(hostedScan).toHaveBeenCalledTimes(1);
    expect(ran.code).toBe(0);
    expectOnlyJson(ran.stdout, ran.stderr, result);
    expect(ran.stdout).not.toContain(SECRET);
    expect(ran.stdout).not.toContain("Bearer");
  });

  it("keeps trusted analysis in-process and does not require an API key", async () => {
    const analyzeImpl = vi.fn(async () => completed("safe"));
    const hostedScan = vi.fn<Hosted>(async () => {
      throw new Error("hosted");
    });

    const ran = await execute(["scan", "--json"], {
      env: { MERGESIGNAL_TRUSTED_ANALYSIS: "1" },
      hostedScan,
      analyzeImpl,
    });

    expect(hostedScan).not.toHaveBeenCalled();
    expect(analyzeImpl).toHaveBeenCalledTimes(1);
    expect(ran.code).toBe(1);
    expectOnlyJson(ran.stdout, ran.stderr, {
      kind: "cli_error",
      code: "output_not_verified",
      message: "These results could not be verified.",
    });
    expect(ran.stdout).not.toContain("MERGESIGNAL_API_KEY is required");
  });

  it("uses the real hosted pipeline for a directory that is not a repository", async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "ms-cli-contract-"));
    const analyzeImpl = vi.fn(async () => {
      throw new Error("analyze");
    });
    const ran = await execute(["scan", "--json"], {
      cwd,
      env: {},
      analyzeImpl,
    });

    expect(analyzeImpl).not.toHaveBeenCalled();
    expect(ran.code).toBe(1);
    expectOnlyJson(ran.stdout, ran.stderr, {
      kind: "cli_preparation",
      outcome: "not_a_git_repository",
      message: "This directory is not a Git repository.",
    });
  });

  it.each([
    ["safe", 0],
    ["needs_review", 0],
    ["risky", 0],
    ["indeterminate", 0],
  ] as const)(
    "exits %s completed scans with %s without --fail-above",
    async (posture, code) => {
      const result = completed(posture);
      const ran = await execute(["scan", "--json"], {
        hostedScan: async () => ({
          ok: true,
          kind: "scan",
          scanId: "scan-1",
          result,
        }),
      });
      expect(ran.code).toBe(code);
      expectOnlyJson(ran.stdout, ran.stderr, result);
    },
  );

  it.each([
    [
      "no_supported_dependency_change",
      "No supported dependency lockfile changed.",
    ],
    [
      "no_dependency_upgrade_episode",
      "No dependency upgrade was found in the supported lockfile.",
    ],
  ] as const)(
    "finishes %s locally without an API key",
    async (outcome, message) => {
      const hostedScan = vi.fn<Hosted>(async () => noop(outcome));
      const ran = await execute(["scan", "--json"], {
        env: {},
        hostedScan,
      });
      expect(hostedScan).toHaveBeenCalledTimes(1);
      expect(ran.code).toBe(0);
      expectOnlyJson(ran.stdout, ran.stderr, {
        kind: "cli_preparation",
        outcome,
        message,
      });
    },
  );

  it("prints a no-op on stdout and a preparation failure on stderr", async () => {
    const success = await execute(["scan"], {
      hostedScan: async () => noop("no_supported_dependency_change"),
    });
    expect(success.code).toBe(0);
    expect(success.stdout).toBe("No supported dependency lockfile changed.\n");
    expect(success.stderr).toBe("");

    const failure = await execute(["scan"], {
      hostedScan: async () => ({
        ok: false,
        kind: "local",
        outcome: "uncommitted_changes",
      }),
    });
    expect(failure.code).toBe(1);
    expect(failure.stdout).toBe("");
    expect(failure.stderr).toBe(
      "Tracked changes must be committed before scanning.\n",
    );
  });

  it.each([
    ["not_a_git_repository", "This directory is not a Git repository."],
    ["base_required", "No comparison base is configured for this branch."],
    [
      "uncommitted_changes",
      "Tracked changes must be committed before scanning.",
    ],
    [
      "history_insufficient",
      "Git history is not sufficient to compare this change.",
    ],
    ["git_read_failed", "The repository could not be read."],
  ] as const)("exits 1 for %s", async (outcome, message) => {
    const ran = await execute(["scan", "--json"], {
      hostedScan: async () => ({ ok: false, kind: "local", outcome }),
    });
    expect(ran.code).toBe(1);
    expectOnlyJson(ran.stdout, ran.stderr, {
      kind: "cli_preparation",
      outcome,
      message,
    });
  });

  it("treats an invalid explicit base as a usage error and still passes it through", async () => {
    const hostedScan = vi.fn<Hosted>(async (input) => {
      expect(input.base).toBe("not-a-commit");
      return { ok: false, kind: "local", outcome: "invalid_base" };
    });
    const ran = await execute(["scan", "--base", "not-a-commit", "--json"], {
      hostedScan,
    });
    expect(ran.code).toBe(2);
    expectOnlyJson(ran.stdout, ran.stderr, {
      kind: "cli_error",
      code: "invalid_base",
      message: "The base revision is not a commit in this repository.",
    });
  });

  it.each([
    [
      "missing_api_key",
      "MERGESIGNAL_API_KEY is required to run a hosted scan.",
    ],
    ["unauthorized", "The API key was rejected."],
    ["transient", "The hosted scan request did not complete."],
    [
      "invalid_response",
      "The hosted scan service returned an unusable response.",
    ],
    [
      "fulfillment_expired",
      "The Git object request expired before it could be fulfilled.",
    ],
    ["scan_timed_out", "The hosted scan did not finish in time."],
    ["object_unavailable", "A required Git object could not be read."],
  ] as const)("exits 1 for hosted %s", async (code, message) => {
    const ran = await execute(["scan", "--json"], {
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan: async () => ({
        ok: false,
        kind: "hosted",
        failure: { code },
      }),
    });
    expect(ran.code).toBe(1);
    expectOnlyJson(ran.stdout, ran.stderr, {
      kind: "cli_error",
      code,
      message,
    });
    expect(ran.stdout).not.toContain(SECRET);
  });

  it("keeps server entitlement fields and does not add commercial copy", async () => {
    const ran = await execute(["scan", "--json", "--fail-above", "0"], {
      hostedScan: async () => ({
        ok: false,
        kind: "hosted",
        failure: {
          code: "entitlement_exhausted",
          limit: 10,
          used: 10,
          resetsAt: "2026-10-27T00:00:00.000Z",
        },
      }),
    });
    expect(ran.code).toBe(1);
    expectOnlyJson(ran.stdout, ran.stderr, {
      kind: "cli_error",
      code: "entitlement_exhausted",
      message: "The analysis allowance is exhausted.",
      limit: 10,
      used: 10,
      resetsAt: "2026-10-27T00:00:00.000Z",
    });
    expect(ran.stdout.toLowerCase()).not.toContain("upgrade");
    expect(ran.stdout.toLowerCase()).not.toContain("price");
  });

  it("does not pass through hosted failure detail or object bytes", async () => {
    const ran = await execute(["scan", "--json"], {
      hostedScan: async () => ({
        ok: false,
        kind: "hosted",
        failure: {
          code: "scan_failed",
          detail: `stack ${SECRET} blob-bytes`,
        },
      }),
    });
    expect(ran.code).toBe(1);
    expect(ran.stdout).not.toContain(SECRET);
    expect(ran.stdout).not.toContain("blob-bytes");
    expect(ran.stdout).not.toContain("stack");
  });

  it("rejects --trusted before any analysis", async () => {
    const analyzeImpl = vi.fn(async () => {
      throw new Error("analyze");
    });
    const hostedScan = vi.fn<Hosted>(async () => {
      throw new Error("hosted");
    });

    const human = await execute(["scan", "--trusted"], {
      hostedScan,
      analyzeImpl,
    });
    expect(analyzeImpl).not.toHaveBeenCalled();
    expect(hostedScan).not.toHaveBeenCalled();
    expect(human.code).toBe(2);
    expect(human.stderr).toBe("Unknown flag: --trusted\n");
    expect(human.stdout).toBe("");

    const json = await execute(["scan", "--trusted", "--json"], {
      hostedScan,
      analyzeImpl,
    });
    expect(analyzeImpl).not.toHaveBeenCalled();
    expect(hostedScan).not.toHaveBeenCalled();
    expect(json.code).toBe(2);
    expectOnlyJson(json.stdout, json.stderr, {
      kind: "cli_error",
      code: "usage",
      message: "Unknown flag: --trusted",
    });
  });

  it("rejects unknown flags and malformed thresholds before a scan", async () => {
    const hostedScan = vi.fn<Hosted>(async () => {
      throw new Error("hosted");
    });
    const unknown = await execute(["scan", "--unknown", "--json"], {
      hostedScan,
    });
    expect(hostedScan).not.toHaveBeenCalled();
    expect(unknown.code).toBe(2);
    expectOnlyJson(unknown.stdout, unknown.stderr, {
      kind: "cli_error",
      code: "usage",
      message: "Unknown flag: --unknown",
    });

    const threshold = await execute(["scan", "--fail-above", "20abc"], {
      hostedScan,
    });
    expect(hostedScan).not.toHaveBeenCalled();
    expect(threshold.code).toBe(2);
    expect(threshold.stderr).toBe("--fail-above expects a number.\n");
    expect(threshold.stdout).toBe("");
  });

  it("changes only the exit code when --fail-above is exceeded", async () => {
    const result = completed("safe", 40);
    const json = await execute(["scan", "--json", "--fail-above", "20"], {
      hostedScan: async () => ({
        ok: true,
        kind: "scan",
        scanId: "scan-1",
        result,
      }),
    });
    expect(json.code).toBe(3);
    expectOnlyJson(json.stdout, json.stderr, result);
    expect(result.assessment?.posture).toBe("safe");

    const below = await execute(["scan", "--json", "--fail-above", "40"], {
      hostedScan: async () => ({
        ok: true,
        kind: "scan",
        scanId: "scan-1",
        result,
      }),
    });
    expect(below.code).toBe(0);

    const human = await execute(
      ["scan", "--fail-above", "20", "--repo-id", "acme/web"],
      {
        hostedScan: async () => ({
          ok: true,
          kind: "scan",
          scanId: "scan-1",
          result,
        }),
      },
    );
    const bundle = buildScanPresentationBundle({
      result,
      pipelineStatus: "done",
      decision: result.decision?.recommendation,
    });
    expect(bundle).not.toBeNull();
    if (!bundle) return;
    const text = renderCliScanSummaryText(
      presentCliScanSummary(bundle, { repoLabel: "acme/web" }),
    );
    expect(human.code).toBe(3);
    expect(human.stdout).toBe(`${text}\n`);
    expect(human.stderr).toBe("");
    expect(result.assessment?.posture).toBe("safe");
  });

  it("does not let --fail-above turn a no-op into exit 3", async () => {
    const ran = await execute(["scan", "--json", "--fail-above", "0"], {
      hostedScan: async () => noop("no_dependency_upgrade_episode"),
    });
    expect(ran.code).toBe(0);
    expect(JSON.parse(ran.stdout).kind).toBe("cli_preparation");
  });

  it("renders a completed human scan with the existing presenter", async () => {
    const result = completed("safe");
    const ran = await execute(["scan", "--repo-id", "acme/web"], {
      hostedScan: async () => ({
        ok: true,
        kind: "scan",
        scanId: "scan-1",
        result,
      }),
    });
    const bundle = buildScanPresentationBundle({
      result,
      pipelineStatus: "done",
      decision: result.decision?.recommendation,
    });
    expect(bundle).not.toBeNull();
    if (!bundle) return;
    expect(ran.code).toBe(0);
    expect(ran.stdout).toBe(
      `${renderCliScanSummaryText(
        presentCliScanSummary(bundle, { repoLabel: "acme/web" }),
      )}\n`,
    );
    expect(ran.stderr).toBe("");
  });

  it("interrupts an in-flight hosted scan without emitting its result or retrying", async () => {
    const controller = new AbortController();
    const result = completed("safe");
    let calls = 0;
    let finish: (value: Pipeline) => void = () => {};
    const hostedScan: Hosted = () => {
      calls += 1;
      return new Promise((resolve) => {
        finish = resolve;
      });
    };

    const pending = execute(["scan", "--json"], {
      env: { MERGESIGNAL_API_KEY: SECRET },
      hostedScan,
      signal: controller.signal,
    });
    controller.abort("SIGINT");
    const ran = await pending;
    finish({ ok: true, kind: "scan", scanId: "scan-1", result });

    expect(calls).toBe(1);
    expect(ran.code).toBe(130);
    expectOnlyJson(ran.stdout, ran.stderr, {
      kind: "cli_error",
      code: "interrupted",
      message: "The scan was interrupted.",
    });
    expect(ran.stdout).not.toContain("cli-contract-test");
    expect(ran.stdout).not.toContain(SECRET);
  });

  it("uses exit 143 for SIGTERM", async () => {
    const controller = new AbortController();
    let finish: (value: Pipeline) => void = () => {};
    const pending = execute(["scan"], {
      hostedScan: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      signal: controller.signal,
    });
    controller.abort("SIGTERM");
    const ran = await pending;
    finish({ ok: false, kind: "local", outcome: "git_read_failed" });
    expect(ran.code).toBe(143);
    expect(ran.stdout).toBe("");
    expect(ran.stderr).toBe("The scan was interrupted.\n");
  });
});
