/**
 * GitHub Check Run markdown — policy → sections → dumb renderer.
 * Thin projection of ScanResult for PR decision support (not a presentation framework).
 */
import { collectWhyBullets } from "./collectNarrativeWhyBullets.js";
import { deriveScanNarrative } from "./deriveScanNarrative.js";
import { formatInsight } from "./formatInsight.js";
import { normalizeGeneratedText } from "./normalizeGeneratedText.js";
import { selectReviewerGuidance } from "./narrativePresentation.js";
import type { ScanNarrativeFacts } from "./scanNarrativeFacts.js";
import {
  humanizeEngineSurfaceText,
  layerDriverSummary,
  sortPRInsightsForDisplay,
  sortRecommendationsForDisplay,
  truncateWithEllipsis,
} from "./actionsStepSummary.js";
import { mergePostureLabel } from "./riskVocabulary.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import type {
  Finding,
  PRInsight,
  Recommendation,
  ScanResult,
  ScoreLayer,
} from "./types.js";

// --- Caps (change only with tests) ---
export const CHECK_RUN_MAX_WHY_BULLETS = 3;
export const CHECK_RUN_MAX_ACTION_BULLETS = 3;
export const CHECK_RUN_MAX_REPO_DRIVER_PHRASES = 2;
export const CHECK_RUN_ACTION_BULLET_MAX_CHARS = 220;
export const CHECK_RUN_SOFT_MAX_CHARS = 3800;

const LAYER_LABELS: readonly [ScoreLayer, string][] = [
  ["security", "Security"],
  ["maintainability", "Maintainability"],
  ["ecosystem", "Ecosystem"],
  ["upgradeImpact", "Upgrade Impact"],
];

const DEFAULT_SECTION_ORDER = [
  "lead",
  "why",
  "actions",
  "baselineOutcome",
  "repoContext",
  "layerScores",
  "footer",
] as const;

type SectionKind = (typeof DEFAULT_SECTION_ORDER)[number];

export type PrCheckRunTitleOptions = {
  baselineOnly?: boolean;
};

export type PrCheckRunSummaryContext = {
  result: ScanResult;
  scanId: string;
  webAppOrigin: string;
  baseline: boolean;
};

/** Policy flags — one place per product rule. */
export type CheckRunPolicy = {
  baseline: boolean;
  showBaselineOutcome: boolean;
  showRepoGraphContext: boolean;
  showLayerScores: boolean;
  useDetailsForLayers: boolean;
  maxWhyBullets: number;
  maxActionBullets: number;
  maxRepoDriverPhrases: number;
};

export type CheckRunSection =
  | { kind: "lead"; posture: string; riskIndexLine: string | null }
  | { kind: "why"; bullets: string[] }
  | { kind: "actions"; bullets: string[] }
  | { kind: "baselineOutcome"; primary: string; scope?: string }
  | {
      kind: "repoContext";
      score: number;
      driverPhrases: string[];
    }
  | {
      kind: "layerScores";
      rows: Array<{ label: string; score: string; driver: string }>;
    }
  | { kind: "footer"; url: string; label: string };

function roundScore(n: number): number {
  return Math.round(n);
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

export function formatScanDashboardUrl(
  webAppOrigin: string,
  scanId: string,
): string {
  return `${normalizeOrigin(webAppOrigin)}/scan/${scanId}`;
}

export function buildPrCheckRunTitle(
  opts: PrCheckRunTitleOptions = {},
): string {
  const base = scanSurfaceCopy.checkRun.titleBase;
  if (opts.baselineOnly) {
    return `${base} - ${scanSurfaceCopy.checkRun.titleBaselineSuffix}`;
  }
  return base;
}

/** Strong drivers for optional repo-context line (full mode only). */
export function hasStrongRepoGraphDrivers(
  result: ScanResult,
  facts?: ScanNarrativeFacts,
): boolean {
  if (
    facts?.availability.mode === "pr_intelligence" ||
    facts?.availability.tiersPresent.tier1
  ) {
    return false;
  }
  const phrases = collectWhyBullets(
    facts ?? deriveScanNarrative(result),
    result,
    CHECK_RUN_MAX_REPO_DRIVER_PHRASES,
  );
  return phrases.some((p) => p.trim().length >= 12);
}

function hasActionableBullets(result: ScanResult): boolean {
  const insights = Array.isArray(result.insights) ? result.insights : [];
  const recs = Array.isArray(result.recommendations)
    ? result.recommendations
    : [];
  const findings = Array.isArray(result.findings) ? result.findings : [];
  return insights.length > 0 || recs.length > 0 || findings.length > 0;
}

function insightToBullet(insight: PRInsight): string {
  const f = formatInsight(insight);
  const msg = truncateWithEllipsis(
    f.message,
    CHECK_RUN_ACTION_BULLET_MAX_CHARS,
  );
  const action = f.action.trim();
  if (action && action.length < 120) {
    return normalizeGeneratedText(
      `${msg} - ${truncateWithEllipsis(action, 100)}`,
    );
  }
  return msg;
}

function recommendationToBullet(rec: Recommendation): string {
  const title = String(rec.title ?? "").trim();
  const rat = String(rec.rationale ?? "").trim();
  const pkgs =
    Array.isArray(rec.packages) && rec.packages.length > 0
      ? ` (${rec.packages.slice(0, 3).join(", ")}${rec.packages.length > 3 ? ", ..." : ""})`
      : "";
  if (rat && (!title || rat.length > title.length)) {
    return truncateWithEllipsis(rat, CHECK_RUN_ACTION_BULLET_MAX_CHARS) + pkgs;
  }
  const line = title || "Review dependency guidance";
  return truncateWithEllipsis(line, CHECK_RUN_ACTION_BULLET_MAX_CHARS) + pkgs;
}

function findingToBullet(f: Finding): string {
  const title = String(f.title ?? "").trim();
  const pkg = f.packageName ? ` (\`${f.packageName}\`)` : "";
  return (
    truncateWithEllipsis(
      title || f.description,
      CHECK_RUN_ACTION_BULLET_MAX_CHARS,
    ) + pkg
  );
}

function guidanceToActionBullet(
  g: ScanNarrativeFacts["reviewerGuidance"][number],
): string {
  const msg = truncateWithEllipsis(
    g.message.trim(),
    CHECK_RUN_ACTION_BULLET_MAX_CHARS,
  );
  const action = g.remediation?.trim();
  if (action && action.length < 120) {
    return normalizeGeneratedText(
      `${msg} - ${truncateWithEllipsis(action, 100)}`,
    );
  }
  return normalizeGeneratedText(msg);
}

function buildActionBulletsFromFacts(
  facts: ScanNarrativeFacts,
  result: ScanResult,
  max: number,
): string[] {
  const prIntel =
    facts.availability.mode === "pr_intelligence" ||
    facts.availability.tiersPresent.tier1;

  if (!prIntel) {
    return buildActionBullets(result, max);
  }

  const out: string[] = [];
  for (const g of selectReviewerGuidance(facts, { scope: "changed", max })) {
    out.push(guidanceToActionBullet(g));
    if (out.length >= max) return out.slice(0, max);
  }
  if (out.length >= max) return out.slice(0, max);

  const legacy = buildActionBullets(result, max - out.length);
  return [...out, ...legacy].slice(0, max);
}

function buildActionBullets(result: ScanResult, max: number): string[] {
  const out: string[] = [];
  const sortedI = sortPRInsightsForDisplay(
    Array.isArray(result.insights) ? result.insights : [],
  );
  const sortedR = sortRecommendationsForDisplay(
    Array.isArray(result.recommendations) ? result.recommendations : [],
  );
  const findings = Array.isArray(result.findings) ? result.findings : [];

  for (const ins of sortedI) {
    if (out.length >= max) break;
    out.push(insightToBullet(ins));
  }
  for (const rec of sortedR) {
    if (out.length >= max) break;
    out.push(recommendationToBullet(rec));
  }
  for (const f of findings) {
    if (out.length >= max) break;
    if (f.severity === "high" || f.severity === "critical") {
      out.push(findingToBullet(f));
    }
  }
  return out.slice(0, max);
}

function layerScoreRows(result: ScanResult): Array<{
  label: string;
  score: string;
  driver: string;
}> {
  const layers = result.layerScores ?? {};
  const rows: Array<{ label: string; score: string; driver: string }> = [];
  for (const [key, label] of LAYER_LABELS) {
    const v = layers[key];
    const n = typeof v === "number" && Number.isFinite(v) ? v : null;
    if (n === null) continue;
    const drivers = layerDriverSummary(result, key, 120);
    if (!drivers) continue;
    rows.push({
      label,
      score: String(roundScore(n)),
      driver: drivers,
    });
  }
  return rows;
}

export function deriveCheckRunPolicy(
  result: ScanResult,
  ctx: Pick<PrCheckRunSummaryContext, "baseline">,
  facts?: ScanNarrativeFacts,
): CheckRunPolicy {
  const resolvedFacts = facts ?? deriveScanNarrative(result);
  const baseline = ctx.baseline;
  const actionBullets = buildActionBulletsFromFacts(
    resolvedFacts,
    result,
    CHECK_RUN_MAX_ACTION_BULLETS,
  );
  const layerRows = layerScoreRows(result);

  const showRepoGraphContext =
    !baseline &&
    hasStrongRepoGraphDrivers(result, resolvedFacts) &&
    typeof result.totalScore === "number" &&
    Number.isFinite(result.totalScore);

  const showLayerScores = !baseline && layerRows.length > 0;

  return {
    baseline,
    showBaselineOutcome: baseline && actionBullets.length === 0,
    showRepoGraphContext,
    showLayerScores,
    useDetailsForLayers: showLayerScores && layerRows.length >= 2,
    maxWhyBullets: CHECK_RUN_MAX_WHY_BULLETS,
    maxActionBullets: CHECK_RUN_MAX_ACTION_BULLETS,
    maxRepoDriverPhrases: CHECK_RUN_MAX_REPO_DRIVER_PHRASES,
  };
}

function buildLeadSection(
  result: ScanResult,
  policy: Pick<CheckRunPolicy, "baseline" | "showRepoGraphContext">,
): CheckRunSection {
  const posture = result.decision?.recommendation
    ? mergePostureLabel(result.decision.recommendation)
    : scanSurfaceCopy.checkRun.mergePostureUnavailable;
  const total =
    typeof result.totalScore === "number" && Number.isFinite(result.totalScore)
      ? result.totalScore
      : null;
  const showRiskIndexInLead =
    !policy.baseline && !policy.showRepoGraphContext && total !== null;
  const riskIndexLine = showRiskIndexInLead
    ? `${scanSurfaceCopy.checkRun.repoContextLabel} ${roundScore(total)}/100 (${scanSurfaceCopy.product.riskIndexDirectionShort})`
    : null;
  return { kind: "lead", posture, riskIndexLine };
}

export function buildPrCheckRunSections(
  policy: CheckRunPolicy,
  result: ScanResult,
  ctx: PrCheckRunSummaryContext,
  facts?: ScanNarrativeFacts,
): CheckRunSection[] {
  const resolvedFacts = facts ?? deriveScanNarrative(result);
  const sections: Partial<Record<SectionKind, CheckRunSection>> = {};

  sections.lead = buildLeadSection(result, policy);

  const why = collectWhyBullets(resolvedFacts, result, policy.maxWhyBullets);
  if (why.length > 0) {
    sections.why = { kind: "why", bullets: why };
  }

  const actions = buildActionBulletsFromFacts(
    resolvedFacts,
    result,
    policy.maxActionBullets,
  );
  if (actions.length > 0) {
    sections.actions = { kind: "actions", bullets: actions };
  }

  if (policy.showBaselineOutcome) {
    sections.baselineOutcome = {
      kind: "baselineOutcome",
      primary: scanSurfaceCopy.checkRun.baselineOutcomePrimary,
      scope: scanSurfaceCopy.checkRun.baselineOutcomeScope,
    };
  }

  if (policy.showRepoGraphContext) {
    const score = roundScore(result.totalScore);
    sections.repoContext = {
      kind: "repoContext",
      score,
      driverPhrases: collectWhyBullets(
        resolvedFacts,
        result,
        policy.maxRepoDriverPhrases,
      ),
    };
  }

  if (policy.showLayerScores) {
    const rows = layerScoreRows(result);
    if (rows.length > 0) {
      sections.layerScores = { kind: "layerScores", rows };
    }
  }

  sections.footer = {
    kind: "footer",
    url: formatScanDashboardUrl(ctx.webAppOrigin, ctx.scanId),
    label: scanSurfaceCopy.checkRun.footerLinkLabel,
  };

  const out: CheckRunSection[] = [];
  for (const key of DEFAULT_SECTION_ORDER) {
    const s = sections[key];
    if (s) out.push(s);
  }
  return out;
}

export function renderCheckRunMarkdown(sections: CheckRunSection[]): string {
  const parts: string[] = [];

  for (const section of sections) {
    switch (section.kind) {
      case "lead": {
        parts.push(`**${section.posture}**`);
        if (section.riskIndexLine) {
          parts.push(section.riskIndexLine);
        }
        parts.push("");
        break;
      }
      case "why": {
        for (const b of section.bullets) {
          parts.push(`- ${b}`);
        }
        parts.push("");
        break;
      }
      case "actions": {
        for (const b of section.bullets) {
          parts.push(`- ${b}`);
        }
        parts.push("");
        break;
      }
      case "baselineOutcome": {
        parts.push(section.primary);
        if (section.scope) {
          parts.push("");
          parts.push(section.scope);
        }
        parts.push("");
        break;
      }
      case "repoContext": {
        const drivers = section.driverPhrases.join(" | ");
        parts.push(
          normalizeGeneratedText(
            `${scanSurfaceCopy.checkRun.repoContextLabel} ${section.score}/100 - ${drivers}`,
          ),
        );
        parts.push("");
        break;
      }
      case "layerScores": {
        parts.push("<details>");
        parts.push(
          `<summary>${scanSurfaceCopy.checkRun.layerScoresDetailsSummary}</summary>`,
        );
        parts.push("");
        for (const row of section.rows) {
          parts.push(
            normalizeGeneratedText(
              `- **${row.label}** ${row.score}/100 - ${row.driver}`,
            ),
          );
        }
        parts.push("");
        parts.push("</details>");
        parts.push("");
        break;
      }
      case "footer": {
        parts.push(
          `<a href="${section.url}" target="_blank" rel="noopener noreferrer">${section.label}</a>`,
        );
        break;
      }
      default: {
        const _exhaustive: never = section;
        void _exhaustive;
      }
    }
  }

  let md = normalizeGeneratedText(parts.join("\n").trimEnd());
  if (md.length > CHECK_RUN_SOFT_MAX_CHARS) {
    md = md.slice(0, CHECK_RUN_SOFT_MAX_CHARS - 1) + "...";
  }
  return md;
}

export function buildPrCheckRunSummaryMarkdown(
  ctx: PrCheckRunSummaryContext,
): string {
  const facts = deriveScanNarrative(ctx.result);
  const policy = deriveCheckRunPolicy(
    ctx.result,
    { baseline: ctx.baseline },
    facts,
  );
  const sections = buildPrCheckRunSections(policy, ctx.result, ctx, facts);
  return renderCheckRunMarkdown(sections);
}

/** Whether baseline scan has no actionable PR bullets (for tests / callers). */
export function checkRunHasActionableContent(result: ScanResult): boolean {
  return hasActionableBullets(result);
}
