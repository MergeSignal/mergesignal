/**
 * Append MergeSignal scan markdown to GITHUB_STEP_SUMMARY (GitHub Actions).
 *
 * Usage: node scripts/ci/render-mergesignal-step-summary.mjs <path-to-mergesignal-scan.json>
 *
 * MERGESIGNAL_ACTIONS_SUMMARY_PROFILE=trusted|development
 * - trusted: production layout; stub methodology refused (via @mergesignal/shared).
 * - development: OSS preview (demo title + banner).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertTrustedActionsSummaryAllowed,
  buildActionsStepSummaryMarkdown,
} from "../../packages/shared/dist/index.js";

const jsonPath = process.argv[2] || "mergesignal-scan.json";
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const profileRaw = String(
  process.env.MERGESIGNAL_ACTIONS_SUMMARY_PROFILE ?? "development",
).trim();
const profile = profileRaw === "trusted" ? "trusted" : "development";

const here = path.dirname(fileURLToPath(import.meta.url));
const copyPath = path.join(here, "scan-surface-copy.generated.json");

function loadCopy() {
  try {
    return JSON.parse(fs.readFileSync(copyPath, "utf8"));
  } catch {
    return {};
  }
}

const copy = loadCopy();

if (!summaryPath) {
  console.error(
    "MergeSignal: workflow summary is not available for this step.",
  );
  process.exit(1);
}

const raw = fs.readFileSync(jsonPath, "utf8");
const r = JSON.parse(raw);
const methodology = r.methodologyVersion
  ? String(r.methodologyVersion)
  : null;

try {
  assertTrustedActionsSummaryAllowed(profile, methodology ?? undefined);
} catch (e) {
  console.error(
    e instanceof Error ? e.message : String(e),
  );
  process.exit(1);
}

const markdown = buildActionsStepSummaryMarkdown({
  result: r,
  profile,
  copy,
});

fs.appendFileSync(summaryPath, markdown);
