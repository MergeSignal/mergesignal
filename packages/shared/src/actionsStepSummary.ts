/**
 * GitHub Actions `GITHUB_STEP_SUMMARY` markdown builder.
 *
 * Inventory (legacy `render-mergesignal-step-summary.mjs` → sections):
 * - Demo `#` + banner → `buildDemoHeader`
 * - Trusted `# MergeSignal — … Risk index` → `buildTrustedTitleLines`
 * - `**High/Medium/Low risk**` → folded into title + “why” bullets (posture-first)
 * - Methodology line → `buildMethodologyLine`
 * - `## Recommended actions` + time heuristics → default “what to do” + `<details> More actions`
 * - `<details> Risk breakdown` + layer table + graph one-liner → score + graph `<details>` blocks
 */
import { collectWhyBulletsFromResult } from "./collectNarrativeWhyBullets.js";
import { deriveScanSummaryText } from "./deriveScanSummaryText.js";
import { formatInsight } from "./formatInsight.js";
import { mergePostureLabel } from "./riskVocabulary.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import { isStubMethodologyVersion } from "./trustedScanGuards.js";
import type {
  DependencyGraphInsights,
  PRInsight,
  Recommendation,
  ScanResult,
  ScoreLayer,
} from "./types.js";

export type ActionsSummaryProfile = "trusted" | "development";

/** Default fold: max lines excluding trailing blank (tune with plan §3.0). */
export const ACTIONS_SUMMARY_DEFAULT_MAX_LINES = 18;
/** Default fold: max characters (plan §3.0). */
export const ACTIONS_SUMMARY_DEFAULT_MAX_CHARS = 1200;
/** Full markdown soft cap (character count, includes `<details>` bodies). */
export const ACTIONS_SUMMARY_SOFT_MAX_CHARS = 6200;
/** Truncated recommendation `rationale` in default fold. */
export const ACTIONS_REC_RATIONALE_MAX_CHARS = 130;

const LAYER_ORDER: readonly [
  keyof NonNullable<ScanResult["layerScores"]>,
  string,
][] = [
  ["security", "Security"],
  ["maintainability", "Maintainability"],
  ["ecosystem", "Ecosystem"],
  ["upgradeImpact", "Upgrade Impact"],
] as const;

/** Titles that read like generic hygiene advice — prefer rationale-first layout. */
const GENERIC_RECOMMENDATION_TITLE =
  /\b(reduce|flatten|minimize|minimise|avoid|improve|consider|optimize|optimise|review|upgrade|decrease|increase|check|verify|ensure|audit)\b.*\b(depend|transitiv|surface|depth|chain|area|footprint|overlap|duplicat|lockfile|semver|vulnerabil|supply)/i;

function copyLine(
  flat: Record<string, string>,
  key: string,
  fallback: string,
): string {
  const v = flat[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export function layerRiskBandLabel(score: number | null | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return "—";
  if (score < 20) return "Low";
  if (score < 40) return "Moderate";
  return "High";
}

function shouldShowLayerDrivers(score: number | null | undefined): boolean {
  const band = layerRiskBandLabel(score);
  return band === "High" || band === "Moderate";
}

/**
 * Presentation-only: turn engine metric tokens in explain titles / contribution ids
 * into reviewer-oriented phrasing. Does not add facts — only rewrites known patterns.
 */
export function humanizeEngineSurfaceText(raw: string): string {
  const input = raw.trim();
  if (!input) return input;
  let t = input.replace(/_/g, " ");
  t = t.replace(
    /^(security|maintainability|ecosystem|upgradeimpact|upgrade\s+impact)[.:]\s*/i,
    "",
  );
  const subs: Array<[RegExp, string]> = [
    [
      /ecosystem\.package\s*surface|ecosystem\s+package\s*surface|package\s+surface\b/gi,
      "broad declared package footprint",
    ],
    [
      /graph\.duplicates?\b|graph\s+duplicates?\b/gi,
      "overlapping dependency paths to the same packages",
    ],
    [
      /graph\.fan\s*in\s*max|graph\s+fan\s+in\s+max/gi,
      "many import paths converge on a few widely shared packages",
    ],
    [
      /graph\.fan\s*in|graph\s+fan\s+in/gi,
      "shared packages see many inbound dependency paths",
    ],
    [
      /graph\.transitive(?:\s+volume)?|graph\s+transitive(?:\s+volume)?/gi,
      "transitive dependency volume",
    ],
    [/graph\.depth|graph\s+depth/gi, "indirect dependency depth"],
    [/graph\.hotspot|graph\s+hotspot/gi, "dependency hotspots"],
    [/graph\.hidden|graph\s+hidden/gi, "hidden transitive paths"],
    [
      /graph\.vulnerable|graph\s+vulnerable/gi,
      "known vulnerable packages on the graph",
    ],
    [/graph\.fan|graph\s+fan/gi, "fan-in"],
  ];
  for (const [re, rep] of subs) t = t.replace(re, rep);
  t = t
    .replace(/\bdependency\s+chain\s+depth\b/gi, "indirect dependency depth")
    .replace(/^dependency\s+depth$/gi, "indirect dependency depth");
  t = t.replace(/\s+/g, " ").trim();
  if (!t) return input;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function explainTitlesForLayer(
  result: ScanResult,
  layer: ScoreLayer,
  limit: number,
): string[] {
  const reasons = result.explain?.reasons;
  if (!Array.isArray(reasons)) return [];
  return [...reasons]
    .filter((r): r is NonNullable<typeof r> => Boolean(r) && r.layer === layer)
    .sort(
      (a, b) =>
        Math.abs(Number(b.scoreImpact) || 0) -
        Math.abs(Number(a.scoreImpact) || 0),
    )
    .slice(0, limit)
    .map((r) => humanizeEngineSurfaceText(String(r.title ?? r.id ?? "").trim()))
    .filter(Boolean);
}

function humanizeContributionId(id: string): string {
  return humanizeEngineSurfaceText(id.replace(/[-_]+/g, " ").trim());
}

function contributionHintsForLayer(
  result: ScanResult,
  layer: ScoreLayer,
  limit: number,
): string[] {
  const list = result.contributions;
  if (!Array.isArray(list)) return [];
  return [...list]
    .filter((c): c is NonNullable<typeof c> => Boolean(c) && c.layer === layer)
    .sort(
      (a, b) =>
        Math.abs(Number(b.scoreImpact) || 0) -
        Math.abs(Number(a.scoreImpact) || 0),
    )
    .slice(0, limit)
    .map((c) => humanizeContributionId(String(c.id ?? "")).trim())
    .filter(Boolean);
}

function driverPhraseDedupeKey(phrase: string): string {
  const n = phrase.toLowerCase().replace(/\s+/g, " ").trim();
  if (
    n.includes("indirect dependency depth") ||
    n.includes("dependency chain depth") ||
    n === "dependency depth"
  ) {
    return "__depth__";
  }
  if (
    n.includes("converge on") ||
    n.includes("inbound dependency paths") ||
    n.includes("widely shared packages")
  ) {
    return "__shared_paths__";
  }
  if (n.includes("transitive dependency volume")) return "__transitive_vol__";
  return n;
}

function dedupeDriverDisplayPhrases(phrases: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of phrases) {
    const key = driverPhraseDedupeKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Plain-language drivers for one layer from engine `explain` / `contributions` only (no invented causes). */
export function layerDriverSummary(
  result: ScanResult,
  layer: ScoreLayer,
  maxChars: number,
): string | null {
  const fromExplain = explainTitlesForLayer(result, layer, 5);
  const fromContrib = contributionHintsForLayer(result, layer, 3);
  const parts: string[] = [];
  for (const t of fromExplain) {
    if (!parts.includes(t)) parts.push(t);
  }
  for (const c of fromContrib) {
    const exists = parts.some((p) =>
      p.toLowerCase().includes(c.toLowerCase().slice(0, 12)),
    );
    if (!exists) parts.push(c);
    if (parts.length >= 5) break;
  }
  if (parts.length === 0) return null;
  const deduped = dedupeDriverDisplayPhrases(parts);
  return truncateWithEllipsis(deduped.join(" · "), maxChars);
}

function impactOrder(impact: string | undefined): number {
  const i = (impact ?? "low").toLowerCase();
  if (i === "high") return 3;
  if (i === "medium") return 2;
  return 1;
}

export function sortPRInsightsForDisplay(insights: PRInsight[]): PRInsight[] {
  const prio = (p: PRInsight["priority"]) =>
    p === "critical" ? 3 : p === "high" ? 2 : 1;
  const conf = (c: PRInsight["confidence"]) =>
    c === "confirmed" ? 3 : c === "likely" ? 2 : 1;
  const scope = (s: PRInsight["scope"]) => (s === "changed" ? 2 : 1);
  return [...insights].sort((a, b) => {
    const d = prio(b.priority) - prio(a.priority);
    if (d !== 0) return d;
    const d2 = conf(b.confidence) - conf(a.confidence);
    if (d2 !== 0) return d2;
    return scope(b.scope) - scope(a.scope);
  });
}

export function sortRecommendationsForDisplay(
  recs: Recommendation[],
): Recommendation[] {
  return [...recs].sort((a, b) => {
    const pa = a.priorityScore ?? NaN;
    const pb = b.priorityScore ?? NaN;
    const fa = Number.isFinite(pa);
    const fb = Number.isFinite(pb);
    if (fa && fb && pb !== pa) return pb - pa;
    if (fa !== fb) return fa ? -1 : 1;
    const ia = impactOrder(a.impact);
    const ib = impactOrder(b.impact);
    if (ib !== ia) return ib - ia;
    const ra = a.rank ?? 9999;
    const rb = b.rank ?? 9999;
    return ra - rb;
  });
}

export function truncateWithEllipsis(s: string, maxChars: number): string {
  const t = s.trim();
  if (t.length <= maxChars) return t;
  if (maxChars <= 1) return "…";
  return `${t.slice(0, maxChars - 1)}…`;
}

function scoreBandLabelFromTotal(score: number | null): string {
  if (score === null) return "Unknown risk";
  if (score >= 70) return "High risk";
  if (score >= 40) return "Medium risk";
  return "Low risk";
}

function roundScore(n: number): number {
  return Math.round(n);
}

export function actionsSummaryDefaultFoldPrefix(markdown: string): string {
  const idx = markdown.indexOf("<details>");
  return (idx === -1 ? markdown : markdown.slice(0, idx)).trimEnd();
}

function countLines(s: string): number {
  if (!s) return 0;
  return s.split("\n").length;
}

function enforceDefaultFoldBudget(text: string): string {
  let out = text.trimEnd();
  for (let i = 0; i < 40; i++) {
    const lines = countLines(out);
    const chars = out.length;
    if (
      lines <= ACTIONS_SUMMARY_DEFAULT_MAX_LINES &&
      chars <= ACTIONS_SUMMARY_DEFAULT_MAX_CHARS
    ) {
      return out;
    }
    // Drop from end: remove last non-empty line until within budget (last resort trimmer).
    const parts = out.split("\n");
    if (parts.length <= 3) break;
    parts.pop();
    out = parts.join("\n").trimEnd();
  }
  return out.slice(0, ACTIONS_SUMMARY_DEFAULT_MAX_CHARS).trimEnd();
}

function buildDemoHeader(flat: Record<string, string>, lines: string[]): void {
  const demoTitle = copyLine(
    flat,
    "actions.demoSummaryTitle",
    scanSurfaceCopy.actions.demoSummaryTitle,
  );
  const demoBanner = copyLine(
    flat,
    "actions.demoSummaryBanner",
    scanSurfaceCopy.actions.demoSummaryBanner,
  );
  lines.push(`# ${demoTitle}`);
  lines.push("");
  lines.push(`> **${demoBanner}**`);
  lines.push("");
}

function buildMethodologyLine(
  flat: Record<string, string>,
  methodology: string | null,
  trustedLayout: boolean,
  isStub: boolean,
  lines: string[],
): void {
  if (!methodology) return;
  const methLabel =
    trustedLayout && !isStub
      ? copyLine(
          flat,
          "actions.trustedSummaryMethodologyLine",
          scanSurfaceCopy.actions.trustedSummaryMethodologyLine,
        )
      : "Methodology";
  lines.push(`**${methLabel}:** ${methodology}`);
  lines.push("");
}

function qualitativeGraphSentences(g: DependencyGraphInsights): string[] {
  const out: string[] = [];
  const depth =
    typeof g.maxDepth === "number" && Number.isFinite(g.maxDepth)
      ? g.maxDepth
      : null;
  const nodes =
    typeof g.nodes === "number" && Number.isFinite(g.nodes) ? g.nodes : null;
  const hotspotCount = Array.isArray(g.hotspots) ? g.hotspots.length : 0;

  if (depth !== null && depth >= 8) {
    out.push(
      "The deepest resolved chain is long, so indirect impact from upgrades and security patches is harder to reason about.",
    );
  } else if (depth !== null && depth >= 5) {
    out.push(
      "Dependency chains run moderately deep—expect meaningful transitive distance from your direct dependencies.",
    );
  }
  if (out.length < 2 && nodes !== null && nodes >= 1200) {
    out.push(
      "This is a large resolved install: more packages usually widens the review surface for churn and advisories.",
    );
  } else if (out.length < 2 && nodes !== null && nodes >= 600) {
    out.push(
      "The install graph is fairly broad—watch where new indirect dependencies cluster.",
    );
  }
  if (out.length < 2 && hotspotCount >= 4) {
    out.push(
      "Several packages sit on many import paths—upgrades touching them deserve a quick spot-check.",
    );
  }
  return out.slice(0, 2);
}

function formatGraphNarrativeLines(
  gi: DependencyGraphInsights | undefined,
): string[] {
  const out: string[] = [];
  if (!gi) return out;
  const deepest = Array.isArray(gi.deepest) ? gi.deepest : [];
  for (const d of deepest.slice(0, 2)) {
    const name = String(d?.packageName ?? "package");
    const depth =
      typeof d?.depth === "number" && Number.isFinite(d.depth) ? d.depth : null;
    const direct = Boolean(d?.direct);
    const via = Array.isArray(d?.via) ? d.via.join(" → ") : "";
    const depthPhrase =
      depth === null ? "deep in the graph" : `${depth} levels deep`;
    out.push(
      `- **${name}** is reached ${direct ? "directly" : "transitively"} (${depthPhrase})${via ? ` via ${via}` : ""}.`,
    );
  }
  return out;
}

function graphDetailsHasContent(gi: unknown): boolean {
  if (!gi || typeof gi !== "object") return false;
  const g = gi as DependencyGraphInsights;
  const nodes = g.nodes;
  const depth = g.maxDepth;
  const edges = g.edges;
  const deepest = g.deepest;
  const hotspots = g.hotspots;
  const vulnerable = g.vulnerable;
  return (
    (typeof nodes === "number" && Number.isFinite(nodes)) ||
    (typeof depth === "number" && Number.isFinite(depth)) ||
    (typeof edges === "number" && Number.isFinite(edges)) ||
    (Array.isArray(deepest) && deepest.length > 0) ||
    (Array.isArray(hotspots) && hotspots.length > 0) ||
    (Array.isArray(vulnerable) && vulnerable.length > 0)
  );
}

/** Raw counts: terse when qualitative or deepest-path narrative already carries meaning. */
function buildGraphRawMetricsLine(
  g: DependencyGraphInsights,
  terse: boolean,
): string | null {
  const nodes = g.nodes;
  const depth = g.maxDepth;
  const edges = g.edges;
  const hotspotCount = Array.isArray(g.hotspots) ? g.hotspots.length : 0;
  const vulnCount = Array.isArray(g.vulnerable) ? g.vulnerable.length : 0;

  if (terse) {
    const bits: string[] = [];
    if (typeof depth === "number" && Number.isFinite(depth)) {
      bits.push(`max chain length ${String(depth)}`);
    }
    if (typeof nodes === "number" && Number.isFinite(nodes)) {
      bits.push(`${String(nodes)} resolved packages`);
    }
    if (vulnCount > 0) {
      bits.push(`${String(vulnCount)} with listed advisories`);
    }
    if (bits.length > 0) return `> *${bits.join(" · ")}*`;
    return null;
  }

  const nStr =
    typeof nodes === "number" && Number.isFinite(nodes) ? String(nodes) : "—";
  const dStr =
    typeof depth === "number" && Number.isFinite(depth) ? String(depth) : "—";
  const eStr =
    typeof edges === "number" && Number.isFinite(edges) ? String(edges) : "—";
  return `> *${nStr} packages · max depth ${dStr} · ${eStr} edges${hotspotCount > 0 ? ` · ${hotspotCount} hotspot${hotspotCount > 1 ? "s" : ""}` : ""}${vulnCount > 0 ? ` · ${vulnCount} flagged vulnerable` : ""}*`;
}

function buildScoreBreakdownDetails(
  result: ScanResult,
  flat: Record<string, string>,
  opts: { includeScoreGlossary: boolean },
): string {
  const layers = result.layerScores ?? {};
  const lines: string[] = [];
  lines.push("<details>");
  lines.push(
    `<summary>${copyLine(flat, "actions.scoreBreakdownDetailsSummary", scanSurfaceCopy.actions.scoreBreakdownDetailsSummary)}</summary>`,
  );
  lines.push("");
  if (opts.includeScoreGlossary) {
    lines.push(
      copyLine(
        flat,
        "actions.layerScoreGlossary",
        scanSurfaceCopy.actions.layerScoreGlossary,
      ),
    );
    lines.push("");
  }
  lines.push("| Layer | Score | Layer risk |");
  lines.push("|-------|-------|------------|");
  for (const [key, label] of LAYER_ORDER) {
    const v = layers[key];
    const n = typeof v === "number" && Number.isFinite(v) ? v : null;
    const display = n === null ? "—" : String(roundScore(n));
    const band = layerRiskBandLabel(n);
    lines.push(`| ${label} | ${display} | ${band} |`);
  }
  lines.push("");
  const driverLines: string[] = [];
  for (const [key, label] of LAYER_ORDER) {
    const v = layers[key];
    const n = typeof v === "number" && Number.isFinite(v) ? v : null;
    if (!shouldShowLayerDrivers(n)) continue;
    const drivers = layerDriverSummary(result, key, 200);
    if (drivers) driverLines.push(`- **${label}:** ${drivers}`);
  }
  if (driverLines.length > 0) {
    lines.push(
      `**${copyLine(flat, "actions.layerDriversHeading", scanSurfaceCopy.actions.layerDriversHeading)}**`,
    );
    lines.push(...driverLines);
    lines.push("");
  }
  lines.push("</details>");
  return lines.join("\n");
}

function buildGraphDetails(
  result: ScanResult,
  flat: Record<string, string>,
): string | null {
  const gi = result.graphInsights;
  if (!graphDetailsHasContent(gi)) return null;
  const g = (gi ?? {}) as DependencyGraphInsights;
  const lines: string[] = [];
  lines.push("<details>");
  lines.push(
    `<summary>${copyLine(flat, "actions.dependencyGraphDetailsSummary", scanSurfaceCopy.actions.dependencyGraphDetailsSummary)}</summary>`,
  );
  lines.push("");
  const qualitative = qualitativeGraphSentences(g);
  if (qualitative.length > 0) {
    lines.push(...qualitative);
    lines.push("");
  }
  const narrative = formatGraphNarrativeLines(g);
  if (narrative.length > 0) {
    lines.push(...narrative);
    lines.push("");
  }
  const note = copyLine(
    flat,
    "actions.supportingGraphContextNote",
    scanSurfaceCopy.actions.supportingGraphContextNote,
  );
  lines.push(`*${note}*`);
  lines.push("");
  const hasStory = qualitative.length > 0 || narrative.length > 0;
  let rawLine = buildGraphRawMetricsLine(g, hasStory);
  if (!rawLine) rawLine = buildGraphRawMetricsLine(g, false);
  if (rawLine) lines.push(rawLine);
  const vulnCount = Array.isArray(g.vulnerable) ? g.vulnerable.length : 0;
  if (vulnCount > 0) {
    lines.push("");
    lines.push(
      copyLine(
        flat,
        "actions.vulnerableReviewerHint",
        scanSurfaceCopy.actions.vulnerableReviewerHint,
      ),
    );
  }
  lines.push("");
  lines.push("</details>");
  return lines.join("\n");
}

function renderInsightDetailsBlock(insight: PRInsight): string {
  const f = formatInsight(insight);
  const bits = [
    `**${insight.priority}** · ${insight.type.replace(/_/g, " ")}`,
    "",
    f.message,
  ];
  if (f.where) {
    bits.push("", "**Where it shows up**", "", f.where);
  }
  if (f.action) {
    bits.push("", "**What to do**", "", f.action);
  }
  return bits.join("\n");
}

function buildMoreInsightsDetails(
  insights: PRInsight[],
  flat: Record<string, string>,
): string | null {
  if (insights.length === 0) return null;
  const lines: string[] = [];
  lines.push("<details>");
  lines.push(
    `<summary>${copyLine(flat, "actions.moreInsightsDetailsSummary", scanSurfaceCopy.actions.moreInsightsDetailsSummary)} (${insights.length})</summary>`,
  );
  lines.push("");
  const blocks = insights.map((ins) => renderInsightDetailsBlock(ins));
  lines.push(blocks.join("\n\n---\n\n"));
  lines.push("");
  lines.push("</details>");
  return lines.join("\n");
}

function buildMoreActionsDetails(
  recs: Recommendation[],
  flat: Record<string, string>,
): string | null {
  if (recs.length === 0) return null;
  const lines: string[] = [];
  lines.push("<details>");
  lines.push(
    `<summary>${copyLine(flat, "actions.moreActionsDetailsSummary", scanSurfaceCopy.actions.moreActionsDetailsSummary)} (${recs.length})</summary>`,
  );
  lines.push("");
  recs.forEach((rec, i) => {
    const bodyLines = formatRecommendationPrimaryLines(
      rec,
      ACTIONS_REC_RATIONALE_MAX_CHARS,
    );
    const pkgs =
      Array.isArray(rec.packages) && rec.packages.length > 0
        ? `\`${rec.packages.slice(0, 8).join("`, `")}\`${rec.packages.length > 8 ? ` +${rec.packages.length - 8} more` : ""}`
        : "";
    bodyLines.forEach((line, j) => {
      if (j === 0) {
        lines.push(`${i + 1}. ${line}`);
      } else {
        lines.push(line);
      }
    });
    if (pkgs) {
      lines.push("");
      lines.push(`Packages: ${pkgs}`);
    }
    lines.push("");
  });
  lines.push("</details>");
  return lines.join("\n");
}

type WhatItem =
  | { kind: "insight"; insight: PRInsight }
  | { kind: "rec"; rec: Recommendation };

function buildTrustedTitleLines(
  result: ScanResult,
  flat: Record<string, string>,
): string[] {
  const total =
    typeof result.totalScore === "number" && Number.isFinite(result.totalScore)
      ? result.totalScore
      : null;
  const direction = copyLine(
    flat,
    "actions.riskIndexDirectionShort",
    scanSurfaceCopy.actions.riskIndexDirectionShort,
  );
  const decision = result.decision;
  const postureToken = decision?.recommendation;
  const postureLabel = postureToken
    ? mergePostureLabel(postureToken)
    : copyLine(
        flat,
        "actions.mergePostureUnavailableShort",
        scanSurfaceCopy.actions.mergePostureUnavailableShort,
      );
  const indexPart =
    total === null
      ? "Risk index unavailable"
      : `Risk index ${roundScore(total)}/100`;
  const titleLines: string[] = [];
  const productPrefix = copyLine(
    flat,
    "actions.trustedStepSummaryTitlePrefix",
    scanSurfaceCopy.actions.trustedStepSummaryTitlePrefix,
  );
  titleLines.push(
    `# ${productPrefix} — ${postureLabel} · ${indexPart} (${direction})`,
  );
  if (!postureToken && total !== null) {
    titleLines.push("");
    titleLines.push(
      `*${copyLine(flat, "actions.mergePostureUnavailableDetail", scanSurfaceCopy.actions.mergePostureUnavailableDetail)}*`,
    );
  }
  return titleLines;
}

function collectWhyBullets(result: ScanResult, max: number): string[] {
  return dedupeDriverDisplayPhrases(collectWhyBulletsFromResult(result, max));
}

function buildWhatToDoItems(result: ScanResult): {
  defaultItems: WhatItem[];
  overflowInsights: PRInsight[];
  overflowRecs: Recommendation[];
} {
  const sortedI = sortPRInsightsForDisplay(
    Array.isArray(result.insights) ? result.insights : [],
  );
  const sortedR = sortRecommendationsForDisplay(
    Array.isArray(result.recommendations) ? result.recommendations : [],
  );
  const defaultItems: WhatItem[] = [];
  for (const ins of sortedI) {
    if (defaultItems.length >= 3) break;
    defaultItems.push({ kind: "insight", insight: ins });
  }
  for (const rec of sortedR) {
    if (defaultItems.length >= 3) break;
    defaultItems.push({ kind: "rec", rec });
  }
  const insightUsed = defaultItems.filter((x) => x.kind === "insight").length;
  const recUsed = defaultItems.filter((x) => x.kind === "rec").length;
  const overflowInsights = sortedI.slice(insightUsed);
  const overflowRecs = sortedR.slice(recUsed);
  return { defaultItems, overflowInsights, overflowRecs };
}

function recommendationLeadsWithRationale(rec: Recommendation): boolean {
  const title = String(rec.title ?? "Review dependencies").trim() || "Review";
  const rat = (rec.rationale ?? "").trim();
  if (!rat) return false;
  return (
    GENERIC_RECOMMENDATION_TITLE.test(title) ||
    (rat.length > title.length * 1.15 && title.length < 52)
  );
}

function formatRecommendationPrimaryLines(
  rec: Recommendation,
  rationaleMax: number,
  opts?: {
    copy?: Record<string, string>;
    recReviewPrefix?: boolean;
  },
): string[] {
  const title = String(rec.title ?? "Review dependencies").trim() || "Review";
  const rat = (rec.rationale ?? "").trim();
  if (!rat) return [`**${title}**`];
  const leadWithRationale =
    GENERIC_RECOMMENDATION_TITLE.test(title) ||
    (rat.length > title.length * 1.15 && title.length < 52);
  if (leadWithRationale) {
    const ratBudget = Math.min(220, rationaleMax + 85);
    let ratTrunc = truncateWithEllipsis(rat, ratBudget);
    if (opts?.copy && opts?.recReviewPrefix) {
      const prefix = copyLine(
        opts.copy,
        "actions.recReviewLeadPrefix",
        scanSurfaceCopy.actions.recReviewLeadPrefix,
      ).trim();
      ratTrunc = truncateWithEllipsis(
        rat,
        Math.max(48, ratBudget - prefix.length - 2),
      );
      ratTrunc = `${prefix} ${ratTrunc}`.trim();
    }
    return [ratTrunc, `   → *Focus:* **${title}**`];
  }
  return [`**${title}** — ${truncateWithEllipsis(rat, rationaleMax)}`];
}

function formatDefaultWhatLine(
  item: WhatItem,
  index: number,
  opts: {
    firstInsightSubLine: boolean;
    rationaleMax: number;
    copy: Record<string, string>;
    applyRecReviewPrefix: boolean;
  },
): string[] {
  const linesOut: string[] = [];
  if (item.kind === "insight") {
    const f = formatInsight(item.insight);
    const msg = truncateWithEllipsis(f.message, 220);
    linesOut.push(`${index}. ${msg}`);
    if (opts.firstInsightSubLine) {
      const sub = f.where.trim() || f.action.trim();
      if (sub) {
        linesOut.push(`   - ${truncateWithEllipsis(sub, 140)}`);
      }
    }
    return linesOut;
  }
  const rec = item.rec;
  const parts = formatRecommendationPrimaryLines(rec, opts.rationaleMax, {
    copy: opts.copy,
    recReviewPrefix: opts.applyRecReviewPrefix,
  });
  parts.forEach((line, j) => {
    linesOut.push(j === 0 ? `${index}. ${line}` : line);
  });
  return linesOut;
}

function appendDevRiskLine(
  result: ScanResult,
  recsLen: number,
  lines: string[],
): void {
  const total =
    typeof result.totalScore === "number" && Number.isFinite(result.totalScore)
      ? result.totalScore
      : null;
  const label = scoreBandLabelFromTotal(total);
  const emoji =
    total === null ? "⚪" : total >= 70 ? "🔴" : total >= 40 ? "⚠️" : "✅";
  const tail = recsLen === 0 ? " — No critical issues" : "";
  lines.push(`${emoji} **${label}**${tail}`);
  lines.push("");
}

export function buildActionsStepSummaryMarkdown(opts: {
  result: ScanResult;
  profile: ActionsSummaryProfile;
  /** Flat JSON from `scan-surface-copy.generated.json`; keys like `actions.demoSummaryTitle`. */
  copy: Record<string, string>;
}): string {
  const { result, profile, copy: flat } = opts;
  const methodology = result.methodologyVersion
    ? String(result.methodologyVersion)
    : null;
  const isStub = isStubMethodologyVersion(methodology ?? undefined);
  const trustedLayout = profile === "trusted" && !isStub;
  const showDemoHeader = profile !== "trusted";

  const lines: string[] = [];
  if (showDemoHeader) {
    buildDemoHeader(flat, lines);
  }

  if (!trustedLayout) {
    const recs = Array.isArray(result.recommendations)
      ? result.recommendations
      : [];
    appendDevRiskLine(result, recs.length, lines);
  }

  const recsAll = Array.isArray(result.recommendations)
    ? result.recommendations
    : [];

  if (trustedLayout) {
    const titleBlock = [...buildTrustedTitleLines(result, flat), ""];

    const why = collectWhyBullets(result, 2);
    const whyLines: string[] = [];
    for (const w of why) {
      whyLines.push(`- ${w}`);
    }
    if (whyLines.length > 0) whyLines.push("");

    const { defaultItems, overflowInsights, overflowRecs } =
      buildWhatToDoItems(result);
    const whatLines: string[] = [];
    if (defaultItems.length > 0) {
      let n = 1;
      let usedRecReviewPrefix = false;
      for (let i = 0; i < defaultItems.length; i++) {
        const item = defaultItems[i]!;
        const firstSub = i === 0 && item.kind === "insight";
        const applyRecReviewPrefix =
          item.kind === "rec" &&
          !usedRecReviewPrefix &&
          recommendationLeadsWithRationale(item.rec);
        const chunk = formatDefaultWhatLine(item, n, {
          firstInsightSubLine: firstSub,
          rationaleMax: ACTIONS_REC_RATIONALE_MAX_CHARS,
          copy: flat,
          applyRecReviewPrefix,
        });
        if (applyRecReviewPrefix) usedRecReviewPrefix = true;
        whatLines.push(...chunk);
        n += 1;
      }
      whatLines.push("");
    } else {
      whatLines.push(
        "*No prioritized actions in the default summary — see score breakdown below.*",
      );
      whatLines.push("");
    }

    const methLines: string[] = [];
    if (methodology) {
      const methLabel = copyLine(
        flat,
        "actions.trustedSummaryMethodologyLine",
        scanSurfaceCopy.actions.trustedSummaryMethodologyLine,
      );
      methLines.push(`**${methLabel}:** ${methodology}`);
      methLines.push("");
    }

    const headMd = [...titleBlock, ...whyLines, ...whatLines]
      .join("\n")
      .trimEnd();
    const trimmedHead = enforceDefaultFoldBudget(headMd);
    lines.length = 0;
    lines.push(...trimmedHead.split("\n"));
    if (methLines.length > 0) {
      lines.push(...methLines);
    }

    lines.push(
      buildScoreBreakdownDetails(result, flat, {
        includeScoreGlossary: false,
      }),
    );
    const graphBlock = buildGraphDetails(result, flat);
    if (graphBlock) {
      lines.push("");
      lines.push(graphBlock);
    }
    const moreAct = buildMoreActionsDetails(overflowRecs, flat);
    if (moreAct) {
      lines.push("");
      lines.push(moreAct);
    }
    const moreIns = buildMoreInsightsDetails(overflowInsights, flat);
    if (moreIns) {
      lines.push("");
      lines.push(moreIns);
    }
  } else {
    // Development / demo body (parity with legacy: methodology + recs + single details bundle)
    buildMethodologyLine(flat, methodology, false, isStub, lines);
    if (recsAll.length > 0) {
      lines.push(`## Recommended actions (${Math.min(3, recsAll.length)})`);
      const top = sortRecommendationsForDisplay(recsAll).slice(0, 3);
      top.forEach((rec, i) => {
        const title = String(rec.title ?? "Review dependencies");
        const rat = rec.rationale
          ? truncateWithEllipsis(rec.rationale, ACTIONS_REC_RATIONALE_MAX_CHARS)
          : "";
        const pkgs =
          Array.isArray(rec.packages) && rec.packages.length > 0
            ? ` — \`${rec.packages.slice(0, 3).join("`, `")}\`${rec.packages.length > 3 ? `, +${rec.packages.length - 3} more` : ""}`
            : "";
        lines.push(`${i + 1}. **${title}**${rat ? ` — ${rat}` : ""}${pkgs}`);
      });
      lines.push("");
    } else {
      lines.push(
        `## ${copyLine(flat, "actions.devNoImmediateActions", scanSurfaceCopy.actions.devNoImmediateActions)}`,
      );
      lines.push("");
    }
    lines.push(
      buildScoreBreakdownDetails(result, flat, {
        includeScoreGlossary: true,
      }),
    );
    const graphBlock = buildGraphDetails(result, flat);
    if (graphBlock) {
      lines.push("");
      lines.push(graphBlock);
    }
  }

  let md = `${lines.join("\n").trimEnd()}\n`;
  if (md.length > ACTIONS_SUMMARY_SOFT_MAX_CHARS) {
    md = `${md.slice(0, ACTIONS_SUMMARY_SOFT_MAX_CHARS).trimEnd()}\n\n*(Summary truncated for size.)*\n`;
  }
  return md;
}
