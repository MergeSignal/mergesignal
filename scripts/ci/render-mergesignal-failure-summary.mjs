/**
 * Append a calm failure summary to GITHUB_STEP_SUMMARY (no scores).
 * Reads strings from scan-surface-copy.generated.json (repo root).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const here = path.dirname(fileURLToPath(import.meta.url));
const copyPath = path.join(here, "scan-surface-copy.generated.json");

if (!summaryPath) {
  console.error(
    "MergeSignal: workflow summary is not available for this step.",
  );
  process.exit(1);
}

let title = "MergeSignal";
let body =
  "Analysis could not be completed. Check the workflow logs for details.";
try {
  const raw = fs.readFileSync(copyPath, "utf8");
  const j = JSON.parse(raw);
  if (typeof j["actions.failureTitle"] === "string")
    title = j["actions.failureTitle"];
  if (typeof j["actions.failureBody"] === "string")
    body = j["actions.failureBody"];
} catch {
  // fall back to defaults above
}

const lines = [`## ${title}`, "", body, ""];
fs.appendFileSync(summaryPath, `${lines.join("\n")}\n`);
