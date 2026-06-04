#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { analyze } from "@mergesignal/engine";
import type { ScanLockfileInput, ScanResult } from "@mergesignal/shared";
import {
  buildScanPresentationBundle,
  presentCliScanSummary,
  renderCliScanSummaryText,
  scanSurfaceCopy,
  validateTrustedEngineScanResult,
} from "@mergesignal/shared";

type ArgMap = {
  _: string[];
  "--help"?: true;
  "--json"?: true;
  "--out"?: string;
  "--repo-id"?: string;
  "--lockfile"?: string;
  "--fail-above"?: string;
  "--trusted"?: true;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args["--trusted"]) {
    process.env.MERGESIGNAL_TRUSTED_ANALYSIS = "1";
  }

  const [cmd] = args._;

  if (
    !cmd ||
    args["--help"] ||
    cmd === "help" ||
    cmd === "--help" ||
    cmd === "-h"
  ) {
    printHelp();
    process.exit(0);
  }

  if (cmd !== "scan") {
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(2);
  }

  const cwd = getInvocationCwd();
  const repoId =
    String(args["--repo-id"] ?? path.basename(cwd)).trim() || "local";

  const lockfile = await loadLockfile({
    cwd,
    explicitPath: args["--lockfile"],
  });

  let result = (await analyze({
    repoId,
    dependencyGraph: {},
    lockfile,
  })) as ScanResult;

  if (process.env.MERGESIGNAL_TRUSTED_ANALYSIS === "1") {
    try {
      result = validateTrustedEngineScanResult(result);
    } catch (e: unknown) {
      const debug = process.env.MERGESIGNAL_DEBUG === "1";
      const ciLike =
        process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true";
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(
        `${debug || ciLike ? msg : scanSurfaceCopy.cli.stderrOutputNotVerified}\n`,
      );
      process.exit(1);
    }
  }

  const outPath = args["--out"] ? path.resolve(cwd, args["--out"]) : null;
  if (outPath) {
    await writeJsonFile(outPath, result);
  }

  if (args["--json"]) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printSummary({ repoId, lockfile, result, outPath });
  }

  const failAbove = args["--fail-above"]
    ? Number(args["--fail-above"])
    : undefined;
  if (typeof failAbove === "number" && Number.isFinite(failAbove)) {
    const score = result.totalScore;
    if (
      typeof score === "number" &&
      Number.isFinite(score) &&
      score > failAbove
    )
      process.exit(3);
  }
}

function getInvocationCwd() {
  const init = process.env.INIT_CWD ? String(process.env.INIT_CWD) : "";
  const resolved = init ? path.resolve(init) : "";
  return resolved || process.cwd();
}

function printHelp() {
  process.stdout.write(
    [
      "MergeSignal CLI",
      "",
      "Usage:",
      "  mergesignal scan [--repo-id <id>] [--lockfile <path>] [--json] [--out <file>] [--fail-above <n>] [--trusted]",
      "",
      "Examples:",
      "  mergesignal scan",
      "  mergesignal scan --repo-id acme/web --json",
      "  mergesignal scan --lockfile pnpm-lock.yaml --out mergesignal-result.json",
      "  mergesignal scan --fail-above 20",
      "  mergesignal scan --trusted --out result.json",
      "",
      "Notes:",
      "  - MERGESIGNAL_TRUSTED_ANALYSIS=1 or --trusted: require MERGESIGNAL_ENGINE_IMPL and validate scan output (CI-style).",
      "  - Otherwise: set MERGESIGNAL_ENGINE_IMPL for a real engine, or omit for the OSS stub in local development.",
      "  - Lockfile detection prefers pnpm-lock.yaml, then package-lock.json.",
      "",
    ].join("\n"),
  );
}

async function loadLockfile(opts: {
  cwd: string;
  explicitPath?: string;
}): Promise<ScanLockfileInput | undefined> {
  if (opts.explicitPath) {
    const p = path.resolve(opts.cwd, opts.explicitPath);
    const content = await readFile(p, "utf8");
    const manager = inferManagerFromFilename(p);
    if (!manager) {
      throw new Error(
        `Unsupported lockfile: ${path.basename(p)} (supported: pnpm-lock.yaml, package-lock.json)`,
      );
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

function printSummary(opts: {
  repoId: string;
  lockfile?: ScanLockfileInput;
  result: ScanResult;
  outPath: string | null;
}) {
  const bundle = buildScanPresentationBundle({
    result: opts.result,
    pipelineStatus: "done",
    decision: opts.result.decision?.recommendation,
    totalScore: opts.result.totalScore,
  });

  if (bundle) {
    const text = renderCliScanSummaryText(
      presentCliScanSummary(bundle, { repoLabel: opts.repoId }),
    );
    console.log(text);
    if (opts.outPath) {
      console.log(`\nWrote JSON to ${opts.outPath}`);
    }
    return;
  }

  console.error(scanSurfaceCopy.cli.stderrAnalysisIncomplete);
  process.exitCode = 1;
}

function parseArgs(argv: string[]): ArgMap {
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
    if (a === "--trusted") {
      out["--trusted"] = true;
      continue;
    }

    const takesValue =
      a === "--out" ||
      a === "--repo-id" ||
      a === "--lockfile" ||
      a === "--fail-above";
    if (takesValue) {
      const v = argv[i + 1];
      if (!v || v.startsWith("--")) throw new Error(`${a} expects a value`);
      out[a as "--out" | "--repo-id" | "--lockfile" | "--fail-above"] = v;
      i++;
      continue;
    }

    throw new Error(`Unknown flag: ${a}`);
  }
  return out;
}

async function writeJsonFile(p: string, value: unknown) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(p, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main().catch((e: unknown) => {
  const debug = process.env.MERGESIGNAL_DEBUG === "1";
  const msg = e instanceof Error ? e.message : String(e);
  if (
    process.env.MERGESIGNAL_TRUSTED_ANALYSIS === "1" &&
    !debug &&
    typeof msg === "string" &&
    msg.length > 0
  ) {
    process.stderr.write(`${scanSurfaceCopy.cli.stderrAnalysisIncomplete}\n`);
  } else {
    process.stderr.write(`mergesignal: ${msg}\n`);
  }
  process.exit(1);
});
