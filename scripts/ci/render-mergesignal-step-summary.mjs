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
  isStubMethodologyVersion,
} from "../../packages/shared/dist/index.js";

const jsonPath = process.argv[2] || "mergesignal-scan.json";
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
const profile = String(
  process.env.MERGESIGNAL_ACTIONS_SUMMARY_PROFILE ?? "development",
).trim();

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

const isStub = isStubMethodologyVersion(methodology ?? undefined);
const isTrustedLayout = profile === "trusted";

const total =
  typeof r.totalScore === "number" && Number.isFinite(r.totalScore)
    ? r.totalScore
    : null;
const layers = r.layerScores && typeof r.layerScores === "object"
  ? r.layerScores
  : {};
const recs = Array.isArray(r.recommendations) ? r.recommendations : [];
const gi = r.graphInsights && typeof r.graphInsights === "object"
  ? r.graphInsights
  : {};

function getRiskStatus(score) {
  if (score === null) return { emoji: "⚪", label: "Unknown risk" };
  if (score >= 70) return { emoji: "🔴", label: "High risk" };
  if (score >= 40) return { emoji: "⚠️", label: "Medium risk" };
  return { emoji: "✅", label: "Low risk" };
}

function getActionMeta(rec) {
  const impact = rec.impact ?? "low";
  const prio =
    typeof rec.priorityScore === "number" && Number.isFinite(rec.priorityScore)
      ? rec.priorityScore
      : NaN;
  if (impact === "high" || prio >= 80) return { time: "< 5 min" };
  if (impact === "medium" || prio >= 50) return { time: "~15 min" };
  return { time: "~30 min" };
}

function formatLayerStatus(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "—";
  if (score < 20) return `${score} ok`;
  if (score < 40) return `${score} watch`;
  return `${score} attention`;
}

const layerOrder = [
  ["security", "Security"],
  ["maintainability", "Maintainability"],
  ["ecosystem", "Ecosystem"],
  ["upgradeImpact", "Upgrade Impact"],
];

const status = getRiskStatus(total);
const lines = [];

if (profile === "development" || isStub) {
  const demoTitle =
    copy["actions.demoSummaryTitle"] ?? "MergeSignal (demo output)";
  const demoBanner =
    copy["actions.demoSummaryBanner"] ??
    "Sample analysis only — not production MergeSignal results.";
  lines.push(`# ${demoTitle}`);
  lines.push("");
  lines.push(`> **${demoBanner}**`);
  lines.push("");
} else {
  lines.push(`# MergeSignal — ${total === null ? "Score unavailable" : `Risk score ${total}/100`}`);
  lines.push("");
}

const riskLead = isTrustedLayout
  ? `**${status.label}**`
  : `${status.emoji} **${status.label}**${recs.length === 0 ? " — No critical issues" : ""}`;
lines.push(riskLead);
lines.push("");

if (methodology) {
  const methLabel =
    isTrustedLayout && !isStub
      ? copy["actions.trustedSummaryMethodologyLine"] ?? "Methodology"
      : "Methodology";
  lines.push(`**${methLabel}:** ${methodology}`);
  lines.push("");
}

if (recs.length > 0) {
  lines.push(`## Recommended actions (${Math.min(3, recs.length)})`);
  const topRecs = recs.slice(0, 3);
  for (let i = 0; i < topRecs.length; i++) {
    const rec = topRecs[i];
    const meta = getActionMeta(rec);
    const title = String(rec.title ?? "Review dependencies");
    const pkgs =
      Array.isArray(rec.packages) && rec.packages.length > 0
        ? ` — \`${rec.packages.slice(0, 3).join("`, `")}\`${rec.packages.length > 3 ? `, +${rec.packages.length - 3} more` : ""}`
        : "";
    lines.push(`${i + 1}. ${title} (${meta.time})${pkgs}`);
  }
  lines.push("");
} else if (!isTrustedLayout) {
  lines.push("## No immediate actions required");
  lines.push("");
}

lines.push("<details>");
lines.push("<summary>Risk breakdown</summary>");
lines.push("");
lines.push("| Layer | Score | Status |");
lines.push("|-------|-------|--------|");
for (const [key, label] of layerOrder) {
  const v = layers[key];
  const n = typeof v === "number" && Number.isFinite(v) ? v : null;
  const display = n === null ? "—" : String(n);
  lines.push(`| ${label} | ${display} | ${formatLayerStatus(n)} |`);
}
lines.push("");

const nodes = gi.nodes;
const depth = gi.maxDepth;
if (
  (typeof nodes === "number" && Number.isFinite(nodes)) ||
  (typeof depth === "number" && Number.isFinite(depth)) ||
  (Array.isArray(gi.hotspots) && gi.hotspots.length > 0) ||
  (Array.isArray(gi.vulnerable) && gi.vulnerable.length > 0)
) {
  const hotspotCount = Array.isArray(gi.hotspots) ? gi.hotspots.length : 0;
  const vulnCount = Array.isArray(gi.vulnerable) ? gi.vulnerable.length : 0;
  const nStr = typeof nodes === "number" && Number.isFinite(nodes) ? nodes : "—";
  const dStr = typeof depth === "number" && Number.isFinite(depth) ? depth : "—";
  lines.push(
    `**Graph insights**: ${nStr} packages, max depth ${dStr}${hotspotCount > 0 ? `, ${hotspotCount} hotspot${hotspotCount > 1 ? "s" : ""}` : ""}${vulnCount > 0 ? `, ${vulnCount} vulnerable` : ""}`,
  );
}

lines.push("</details>");

fs.appendFileSync(summaryPath, `${lines.join("\n")}\n`);
