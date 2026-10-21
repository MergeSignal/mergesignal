#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { analyze } from "@mergesignal/engine";
import {
  readWorktreeCheckout,
  resolveWorktreeGitDir,
} from "@mergesignal/local-git";
import type {
  ScanLockfileInput,
  ScanRequest,
  ScanResult,
} from "@mergesignal/shared";
import {
  buildScanPresentationBundle,
  freshOutputExpectationFromScanRequest,
  presentCliScanSummary,
  renderCliScanSummaryText,
  resolvePrRiskScore,
  scanSurfaceCopy,
  validateTrustedEngineScanResult,
} from "@mergesignal/shared";

import { resolveApiOrigin } from "./hosted/apiOrigin.js";
import { createHostedScanClient } from "./hosted/client.js";
import { runHostedLocalScan } from "./hosted/hostedScan.js";
import {
  readLastScanPointer,
  writeLastScanPointer,
} from "./lastScanPointer.js";
import {
  POINTER_NOT_SAVED,
  REPORT_API_KEY_REQUIRED,
  errorDocument,
  hostedError,
  interruptionCode,
  interruptionDocument,
  parseFailAbove,
  preparationDocument,
} from "./terminal.js";

type ArgMap = {
  _: string[];
  "--help"?: true;
  "--json"?: true;
  "--out"?: string;
  "--repo-id"?: string;
  "--lockfile"?: string;
  "--base"?: string;
  "--fail-above"?: string;
};

type TextWriter = {
  write(chunk: string): unknown;
};

type CliIo = {
  stdout: TextWriter;
  stderr: TextWriter;
  env: NodeJS.ProcessEnv;
  cwd: string;
  hostedScan: typeof runHostedLocalScan;
  analyzeImpl: typeof analyze;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export async function runCli(
  argv: string[],
  io: Partial<CliIo> = {},
): Promise<number> {
  const bound = bindIo(io);
  let args: ArgMap;
  try {
    args = parseArgs(argv);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid arguments.";
    return emitUsage(bound, argv.includes("--json"), message);
  }

  const trusted = bound.env.MERGESIGNAL_TRUSTED_ANALYSIS === "1";
  const [cmd] = args._;

  if (
    !cmd ||
    args["--help"] ||
    cmd === "help" ||
    cmd === "--help" ||
    cmd === "-h"
  ) {
    printHelp(bound.stdout);
    return 0;
  }

  if (cmd === "report") return runReport(args, bound);

  if (cmd !== "scan") {
    if (args["--json"])
      return emitUsage(bound, true, `Unknown command: ${cmd}`);
    bound.stderr.write(`Unknown command: ${cmd}\n`);
    printHelp(bound.stdout);
    return 2;
  }

  const failAbove = args["--fail-above"];
  let threshold: number | undefined;
  if (failAbove !== undefined) {
    const parsed = parseFailAbove(failAbove);
    if (parsed === null) {
      return emitUsage(
        bound,
        Boolean(args["--json"]),
        "--fail-above expects a number.",
      );
    }
    threshold = parsed;
  }

  const stopped = interrupted(bound.signal);
  if (stopped !== null) return emitInterruption(bound, args, stopped);

  if (trusted) return runTrusted(args, bound, threshold);
  return runHosted(args, bound, threshold);
}

async function runHosted(
  args: ArgMap,
  io: CliIo,
  threshold: number | undefined,
): Promise<number> {
  if (args["--lockfile"] !== undefined) {
    return emitUsage(
      io,
      Boolean(args["--json"]),
      "--lockfile is only available with trusted analysis.",
    );
  }

  const pipeline = io.hostedScan({
    cwd: io.cwd,
    ...(args["--base"] !== undefined ? { base: args["--base"] } : {}),
    env: io.env,
  });
  const outcome = await Promise.race([
    pipeline.then((value) => ({ kind: "result" as const, value })),
    abortOutcome(io.signal),
  ]);
  if (outcome.kind === "abort") {
    return emitInterruption(io, args, outcome.code);
  }

  const result = outcome.value;
  if (!result.ok && result.kind === "local") {
    if (result.outcome === "invalid_base") {
      return emitDocument(
        io,
        args,
        errorDocument(
          "invalid_base",
          "The base revision is not a commit in this repository.",
        ),
        2,
        "stderr",
      );
    }
    return emitDocument(
      io,
      args,
      preparationDocument(result.outcome),
      1,
      "stderr",
    );
  }
  if (result.ok && result.kind === "local") {
    return emitDocument(
      io,
      args,
      preparationDocument(result.observation.outcome),
      0,
      "stdout",
    );
  }
  if (!result.ok && result.kind === "hosted") {
    const failure = result.failure;
    const described = hostedError({
      code: failure.code,
      ...("limit" in failure ? { limit: failure.limit } : {}),
      ...("used" in failure ? { used: failure.used } : {}),
      ...("resetsAt" in failure ? { resetsAt: failure.resetsAt } : {}),
    });
    return emitDocument(io, args, described, 1, "stderr");
  }
  await rememberCompletedScan(io, result);
  return emitCompleted(io, args, result.result, threshold);
}

async function runTrusted(
  args: ArgMap,
  io: CliIo,
  threshold: number | undefined,
): Promise<number> {
  if (args["--base"] !== undefined) {
    return emitUsage(
      io,
      Boolean(args["--json"]),
      "--base is not used with trusted analysis.",
    );
  }

  const repoId =
    String(args["--repo-id"] ?? path.basename(io.cwd)).trim() || "local";
  let lockfile: ScanLockfileInput | undefined;
  try {
    lockfile = await loadLockfile({
      cwd: io.cwd,
      explicitPath: args["--lockfile"],
    });
  } catch (error) {
    if (error instanceof UsageError) {
      return emitUsage(io, Boolean(args["--json"]), error.message);
    }
    return emitDocument(
      io,
      args,
      errorDocument("lockfile_unreadable", "The lockfile could not be read."),
      1,
      "stderr",
    );
  }

  const analyzeRequest: ScanRequest = {
    repoId,
    dependencyGraph: {},
    lockfile,
  };
  let result: ScanResult;
  try {
    result = (await io.analyzeImpl(analyzeRequest)) as ScanResult;
  } catch {
    return emitDocument(
      io,
      args,
      errorDocument(
        "analysis_failed",
        scanSurfaceCopy.cli.stderrAnalysisIncomplete,
      ),
      1,
      "stderr",
    );
  }

  try {
    result = validateTrustedEngineScanResult(
      result,
      freshOutputExpectationFromScanRequest(analyzeRequest),
    );
  } catch (error: unknown) {
    return emitTrustedValidationFailure(io, args, error);
  }

  return emitCompleted(io, args, result, threshold);
}

async function emitCompleted(
  io: CliIo,
  args: ArgMap,
  result: ScanResult,
  threshold: number | undefined,
): Promise<number> {
  const outPath = args["--out"] ? path.resolve(io.cwd, args["--out"]) : null;
  if (outPath) await writeJsonFile(outPath, result);

  const exceeded = thresholdExceeded(result, threshold);
  if (args["--json"]) {
    io.stdout.write(`${JSON.stringify(result)}\n`);
    return exceeded ? 3 : 0;
  }

  const rendered = renderCompleted(result, args, io.cwd);
  if (rendered === null) {
    io.stderr.write(`${scanSurfaceCopy.cli.stderrAnalysisIncomplete}\n`);
    return 1;
  }
  io.stdout.write(`${rendered}\n`);
  if (outPath) io.stdout.write(`\nWrote JSON to ${outPath}\n`);
  return exceeded ? 3 : 0;
}

function renderCompleted(
  result: ScanResult,
  args: ArgMap,
  cwd: string,
): string | null {
  const repoId =
    String(args["--repo-id"] ?? path.basename(cwd)).trim() || "local";
  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
    decision: result.decision?.recommendation,
  });
  if (!bundle) return null;
  return renderCliScanSummaryText(
    presentCliScanSummary(bundle, { repoLabel: repoId }),
  );
}

function thresholdExceeded(
  result: ScanResult,
  threshold: number | undefined,
): boolean {
  if (threshold === undefined) return false;
  const score = resolvePrRiskScore(result);
  return (
    typeof score === "number" && Number.isFinite(score) && score > threshold
  );
}

function emitTrustedValidationFailure(
  io: CliIo,
  args: ArgMap,
  error: unknown,
): number {
  const debug = io.env.MERGESIGNAL_DEBUG === "1";
  const ciLike = io.env.GITHUB_ACTIONS === "true" || io.env.CI === "true";
  const safe = scanSurfaceCopy.cli.stderrOutputNotVerified;
  if (args["--json"]) {
    return emitDocument(
      io,
      args,
      errorDocument("output_not_verified", safe),
      1,
      "stderr",
    );
  }
  const detail = error instanceof Error ? error.message : String(error);
  io.stderr.write(`${debug || ciLike ? detail : safe}\n`);
  return 1;
}

function emitInterruption(io: CliIo, args: ArgMap, code: number): number {
  return emitDocument(io, args, interruptionDocument(), code, "stderr");
}

function emitUsage(io: CliIo, json: boolean, message: string): number {
  if (json) {
    io.stdout.write(`${JSON.stringify(errorDocument("usage", message))}\n`);
    return 2;
  }
  io.stderr.write(`${message}\n`);
  return 2;
}

function emitDocument(
  io: CliIo,
  args: ArgMap,
  document: { message: string },
  code: number,
  human: "stdout" | "stderr",
): number {
  if (args["--json"]) {
    io.stdout.write(`${JSON.stringify(document)}\n`);
    return code;
  }
  const stream = human === "stdout" ? io.stdout : io.stderr;
  stream.write(`${document.message}\n`);
  return code;
}

function interrupted(signal: AbortSignal | undefined): number | null {
  if (!signal?.aborted) return null;
  return interruptionCode(signal.reason);
}

function abortOutcome(
  signal: AbortSignal | undefined,
): Promise<{ kind: "abort"; code: number }> {
  if (!signal) return new Promise(() => {});
  if (signal.aborted) {
    return Promise.resolve({
      kind: "abort",
      code: interruptionCode(signal.reason),
    });
  }
  return new Promise((resolve) => {
    signal.addEventListener(
      "abort",
      () => {
        resolve({ kind: "abort", code: interruptionCode(signal.reason) });
      },
      { once: true },
    );
  });
}

function bindIo(io: Partial<CliIo>): CliIo {
  return {
    stdout: io.stdout ?? process.stdout,
    stderr: io.stderr ?? process.stderr,
    env: io.env ?? process.env,
    cwd: io.cwd ?? getInvocationCwd(),
    hostedScan: io.hostedScan ?? runHostedLocalScan,
    analyzeImpl: io.analyzeImpl ?? analyze,
    ...(io.fetchImpl ? { fetchImpl: io.fetchImpl } : {}),
    ...(io.signal ? { signal: io.signal } : {}),
  };
}

function getInvocationCwd() {
  const init = process.env.INIT_CWD ? String(process.env.INIT_CWD) : "";
  const resolved = init ? path.resolve(init) : "";
  return resolved || process.cwd();
}

async function rememberCompletedScan(
  io: CliIo,
  scan: { scanId: string; headCommit: string },
): Promise<void> {
  const gitDir = await resolveWorktreeGitDir({ cwd: io.cwd });
  if (!gitDir.ok) {
    io.stderr.write(`${POINTER_NOT_SAVED}\n`);
    return;
  }
  try {
    await writeLastScanPointer(gitDir.gitDir, {
      scanId: scan.scanId,
      head: scan.headCommit,
    });
  } catch {
    io.stderr.write(`${POINTER_NOT_SAVED}\n`);
  }
}

async function runReport(args: ArgMap, io: CliIo): Promise<number> {
  if (
    args._.length > 1 ||
    args["--fail-above"] !== undefined ||
    args["--base"] !== undefined ||
    args["--lockfile"] !== undefined ||
    args["--out"] !== undefined ||
    args["--repo-id"] !== undefined
  ) {
    return emitUsage(
      io,
      Boolean(args["--json"]),
      "report accepts only --json.",
    );
  }

  const gitDir = await resolveWorktreeGitDir({ cwd: io.cwd });
  if (!gitDir.ok) {
    return emitDocument(
      io,
      args,
      hostedError({ code: gitDir.outcome }),
      1,
      "stderr",
    );
  }

  const pointer = await readLastScanPointer(gitDir.gitDir);
  if (pointer === "missing" || pointer === "malformed") {
    return emitDocument(
      io,
      args,
      hostedError({
        code:
          pointer === "missing"
            ? "no_remembered_scan"
            : "malformed_scan_reference",
      }),
      1,
      "stderr",
    );
  }

  const apiKey = io.env.MERGESIGNAL_API_KEY;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return emitDocument(
      io,
      args,
      errorDocument("missing_api_key", REPORT_API_KEY_REQUIRED),
      1,
      "stderr",
    );
  }
  const origin = resolveApiOrigin(io.env.MERGESIGNAL_API_ORIGIN);
  if (!origin.ok) {
    return emitDocument(
      io,
      args,
      hostedError({ code: "invalid_origin" }),
      1,
      "stderr",
    );
  }

  const retrieved = await createHostedScanClient({
    origin: origin.origin,
    apiKey,
    ...(io.fetchImpl ? { fetchImpl: io.fetchImpl } : {}),
  }).retrieve(pointer.scanId);
  if (!retrieved.ok) {
    const failure = retrieved.failure;
    return emitDocument(
      io,
      args,
      hostedError({
        code: failure.code,
        ...("limit" in failure ? { limit: failure.limit } : {}),
        ...("used" in failure ? { used: failure.used } : {}),
        ...("resetsAt" in failure ? { resetsAt: failure.resetsAt } : {}),
      }),
      1,
      "stderr",
    );
  }

  if (args["--json"]) {
    io.stdout.write(`${JSON.stringify(retrieved.result)}\n`);
    return 0;
  }

  const rendered = renderCompleted(retrieved.result, args, io.cwd);
  if (rendered === null) {
    io.stderr.write(`${scanSurfaceCopy.cli.stderrAnalysisIncomplete}\n`);
    return 1;
  }
  const lines = ["Completed scan"];
  const current = await readWorktreeCheckout({ cwd: io.cwd });
  if (current.ok && current.headCommit !== pointer.head) {
    lines.push(
      `Scanned HEAD ${pointer.head}`,
      `Current HEAD ${current.headCommit}`,
    );
  }
  io.stdout.write(`${lines.join("\n")}\n\n${rendered}\n`);
  return 0;
}

function printHelp(stdout: TextWriter) {
  stdout.write(
    [
      "MergeSignal CLI",
      "",
      "Usage:",
      "  mergesignal scan [--repo-id <id>] [--base <revision>] [--json] [--out <file>] [--fail-above <n>]",
      "  mergesignal report [--json]",
      "",
      "Examples:",
      "  mergesignal scan",
      "  mergesignal scan --base origin/main",
      "  mergesignal scan --json --out result.json",
      "  mergesignal scan --fail-above 20",
      "  mergesignal report",
      "  mergesignal report --json",
      "",
      "Notes:",
      "  - Assesses a dependency upgrade from committed Git history.",
      "  - Set MERGESIGNAL_API_KEY before scanning.",
      "  - --base selects the comparison revision.",
      "  - --json prints the authoritative scan result.",
      "  - --fail-above <n> fails the command when PR Risk is greater than n.",
      "  - No supported lockfile change finishes without a scan.",
      "  - report shows the last completed scan for this worktree and does not run another analysis.",
      "",
    ].join("\n"),
  );
}

export function parseArgs(argv: string[]): ArgMap {
  const out: ArgMap = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") continue;
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }

    if (a === "--help") {
      out["--help"] = true;
      continue;
    }
    if (a === "--json") {
      out["--json"] = true;
      continue;
    }

    const takesValue =
      a === "--out" ||
      a === "--repo-id" ||
      a === "--lockfile" ||
      a === "--base" ||
      a === "--fail-above";
    if (takesValue) {
      const v = argv[i + 1];
      if (!v || v.startsWith("--"))
        throw new UsageError(`${a} expects a value`);
      out[
        a as "--out" | "--repo-id" | "--lockfile" | "--base" | "--fail-above"
      ] = v;
      i++;
      continue;
    }

    throw new UsageError(`Unknown flag: ${a}`);
  }
  return out;
}

async function loadLockfile(opts: {
  cwd: string;
  explicitPath?: string;
}): Promise<ScanLockfileInput | undefined> {
  if (opts.explicitPath) {
    const p = path.resolve(opts.cwd, opts.explicitPath);
    const manager = inferManagerFromFilename(p);
    if (!manager) {
      throw new UsageError(
        `Unsupported lockfile: ${path.basename(p)} (supported: pnpm-lock.yaml, package-lock.json)`,
      );
    }
    let content: string;
    try {
      content = await readFile(p, "utf8");
    } catch {
      throw new Error("lockfile unreadable");
    }
    return { manager, content, path: path.relative(opts.cwd, p) };
  }

  const candidates: Array<{
    filename: string;
    manager: ScanLockfileInput["manager"];
  }> = [
    { filename: "pnpm-lock.yaml", manager: "pnpm" },
    { filename: "package-lock.json", manager: "npm" },
  ];

  for (const c of candidates) {
    try {
      const full = path.join(opts.cwd, c.filename);
      const content = await readFile(full, "utf8");
      return { manager: c.manager, content, path: c.filename };
    } catch {
      // keep searching
    }
  }

  return undefined;
}

function inferManagerFromFilename(
  p: string,
): ScanLockfileInput["manager"] | null {
  const base = path.basename(p).toLowerCase();
  if (base === "pnpm-lock.yaml") return "pnpm";
  if (base === "package-lock.json") return "npm";
  if (base === "yarn.lock") return "yarn";
  return null;
}

async function writeJsonFile(p: string, value: unknown) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(p, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

async function main(): Promise<number> {
  const controller = new AbortController();
  const onSignal = (signal: NodeJS.Signals) => {
    controller.abort(signal);
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  return runCli(process.argv.slice(2), {
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    cwd: getInvocationCwd(),
    signal: controller.signal,
  });
}

if (isDirectRun()) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch(() => {
      process.stderr.write("The scan could not be completed.\n");
      process.exit(1);
    });
}
