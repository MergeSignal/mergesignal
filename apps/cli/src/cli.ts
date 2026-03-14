#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { analyze } from "@reposentinel/engine";
import type { ScanLockfileInput, ScanResult, ScoreLayer } from "@reposentinel/shared";

type ArgMap = {
  _: string[];
  "--help"?: true;
  "--json"?: true;
  "--out"?: string;
  "--repo-id"?: string;
  "--lockfile"?: string;
  "--fail-above"?: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd] = args._;

  if (!cmd || args["--help"] || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(0);
  }

  if (cmd !== "scan") {
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(2);
  }

  const cwd = getInvocationCwd();
  const repoId = String(args["--repo-id"] ?? path.basename(cwd)).trim() || "local";

  const lockfile = await loadLockfile({ cwd, explicitPath: args["--lockfile"] });

  const result = (await analyze({
    repoId,
    dependencyGraph: {},
    lockfile,
  })) as ScanResult;

  const outPath = args["--out"] ? path.resolve(cwd, args["--out"]) : null;
  if (outPath) {
    await writeJsonFile(outPath, result);
  }

  if (args["--json"]) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printSummary({ repoId, lockfile, result, outPath });
  }

  const failAbove = args["--fail-above"] ? Number(args["--fail-above"]) : undefined;
  if (typeof failAbove === "number" && Number.isFinite(failAbove)) {
    const score = Number(result.totalScore ?? 0);
    if (score > failAbove) process.exit(3);
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
      "RepoSentinel CLI",
      "",
      "Usage:",
      "  reposentinel scan [--repo-id <id>] [--lockfile <path>] [--json] [--out <file>] [--fail-above <n>]",
      "",
      "Examples:",
      "  reposentinel scan",
      "  reposentinel scan --repo-id acme/web --json",
      "  reposentinel scan --lockfile pnpm-lock.yaml --out reposentinel-result.json",
      "  reposentinel scan --fail-above 20",
      "",
      "Notes:",
      "  - This runs analysis locally using @reposentinel/engine-stub.",
      "  - Lockfile detection prefers pnpm-lock.yaml, then package-lock.json.",
      "",
    ].join("\n"),
  );
}

async function loadLockfile(opts: { cwd: string; explicitPath?: string }): Promise<ScanLockfileInput | undefined> {
  if (opts.explicitPath) {
    const p = path.resolve(opts.cwd, opts.explicitPath);
    const content = await readFile(p, "utf8");
    const manager = inferManagerFromFilename(p);
    if (!manager) {
      throw new Error(`Unsupported lockfile: ${path.basename(p)} (supported: pnpm-lock.yaml, package-lock.json)`);
    }
    return { manager, content, path: path.relative(opts.cwd, p) };
  }

  const candidates: Array<{ filename: string; manager: ScanLockfileInput["manager"] }> = [
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

function inferManagerFromFilename(p: string): ScanLockfileInput["manager"] | null {
  const base = path.basename(p).toLowerCase();
  if (base === "pnpm-lock.yaml") return "pnpm";
  if (base === "package-lock.json") return "npm";
  return null;
}

function printSummary(opts: { repoId: string; lockfile?: ScanLockfileInput; result: ScanResult; outPath: string | null }) {
  const { result } = opts;
  const score = typeof result.totalScore === "number" ? result.totalScore : null;
  const conf = result.confidence ? String(result.confidence) : "n/a";
  const method = result.methodologyVersion ? String(result.methodologyVersion) : "n/a";

  const layers = result.layerScores ?? ({} as any);
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const recs = Array.isArray(result.recommendations) ? result.recommendations : [];

  const lockfileLine = opts.lockfile ? `${opts.lockfile.path} (${opts.lockfile.manager})` : "none";

  const lines: string[] = [];
  lines.push("");
  lines.push(`RepoSentinel • ${opts.repoId}`);
  lines.push(`Lockfile: ${lockfileLine}`);
  lines.push(`Method: ${method} • Confidence: ${conf}`);
  lines.push("");
  lines.push(`Total score: ${score ?? "n/a"} (0 best → 100 worst)`);
  lines.push(`Layers: ${formatLayers(layers)}`);
  lines.push(`Findings: ${findings.length} • Recommendations: ${recs.length}`);

  if (recs.length) {
    lines.push("");
    lines.push("Top recommendations:");
    for (const r of recs.slice(0, 5)) {
      const title = String((r as any)?.title ?? "Untitled");
      const prio = Number((r as any)?.priorityScore ?? 0);
      lines.push(`- ${title} (${prio})`);
    }
  }

  if (opts.outPath) {
    lines.push("");
    lines.push(`Wrote JSON: ${opts.outPath}`);
  }

  lines.push("");
  process.stdout.write(`${lines.join("\n")}\n`);
}

function formatLayers(layers: Record<string, unknown>) {
  const order: ScoreLayer[] = ["security", "maintainability", "ecosystem", "upgradeImpact"];
  const bits = order.map((k) => `${k}=${toShortNumber((layers as any)[k])}`);
  return bits.join(" • ");
}

function toShortNumber(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.round(v));
  const n = Number(v);
  if (Number.isFinite(n)) return String(Math.round(n));
  return "n/a";
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

    const takesValue = a === "--out" || a === "--repo-id" || a === "--lockfile" || a === "--fail-above";
    if (takesValue) {
      const v = argv[i + 1];
      if (!v || v.startsWith("--")) throw new Error(`${a} expects a value`);
      (out as any)[a] = v;
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

main().catch((e: any) => {
  const msg = String(e?.message ?? e);
  process.stderr.write(`reposentinel: ${msg}\n`);
  process.exit(1);
});

