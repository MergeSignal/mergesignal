/**
 * Post-render audit for trusted GitHub Actions scan (methodology + explicit denylist).
 * Usage: node audit-trusted-actions-output.mjs <scan.json> <step-summary-file>
 *
 * Expects @mergesignal/shared built at packages/shared/dist (pnpm build in repo root).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const jsonPath = process.argv[2];
const summaryPath = process.argv[3] ?? process.env.GITHUB_STEP_SUMMARY;

if (!jsonPath || !summaryPath) {
  console.error(
    "audit-trusted-actions-output: usage: node audit-trusted-actions-output.mjs <scan.json> <summary-path>",
  );
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sharedEntry = path.join(here, "..", "packages", "shared", "dist", "index.js");
const { auditTrustedActionsOutput } = await import(pathToFileURL(sharedEntry).href);

const scanResult = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const summaryText = fs.readFileSync(summaryPath, "utf8");

const result = auditTrustedActionsOutput({
  summaryText,
  scanResult,
  requireTrustedEnv: true,
});

if (!result.ok) {
  for (const err of result.errors) {
    console.error(`audit-trusted-actions-output: ${err}`);
  }
  process.exit(1);
}
