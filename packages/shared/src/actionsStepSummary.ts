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
} from "./types.js";

export type ActionsSummaryProfile = "trusted" | "development";

/** Default fold: max lines excluding trailing blank (tune with plan §3.0). */
export const ACTIONS_SUMMARY_DEFAULT_MAX_LINES = 18;
/** Default fold: max characters (plan §3.0). */
export const ACTIONS_SUMMARY_DEFAULT_MAX_CHARS = 1200;
/** Full markdown soft cap (character count, includes `<details>` bodies). */
export const ACTIONS_SUMMARY_SOFT_MAX_CHARS = 6200;
/** Truncated recommendation `rationale` in default fold. */
export const ACTIONS_REC_RATIONALE_MAX_CHARS = 110;

const LAYER_ORDER: readonly [
  keyof NonNullable<ScanResult["layerScores"]>,
  string,
][] = [
  ["security", "Security"],
  ["maintainability", "Maintainability"],
  ["ecosystem", "Ecosystem"],
  ["upgradeImpact", "Upgrade Impact"],
] as const;

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

function formatGraphNarrativeLines(
  gi: DependencyGraphInsights | undefined,
  flat: Record<string, string>,
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
    const depthStr = depth === null ? "n/a" : String(depth);
    out.push(
      `- **${name}** is ${direct ? "direct" : "transitive"} at depth ${depthStr}${via ? ` via ${via}` : ""}.`,
    );
  }
  if (out.length === 0) return out;
  const note = copyLine(
    flat,
    "actions.supportingGraphContextNote",
    scanSurfaceCopy.actions.supportingGraphContextNote,
  );
  out.push("");
  out.push(`*${note}*`);
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

function buildScoreBreakdownDetails(
  result: ScanResult,
  flat: Record<string, string>,
): string {
  const layers = result.layerScores ?? {};
  const lines: string[] = [];
  lines.push("<details>");
  lines.push(
    `<summary>${copyLine(flat, "actions.scoreBreakdownDetailsSummary", scanSurfaceCopy.actions.scoreBreakdownDetailsSummary)}</summary>`,
  );
  lines.push("");
  lines.push(
    copyLine(
      flat,
      "actions.layerScoreGlossary",
      scanSurfaceCopy.actions.layerScoreGlossary,
    ),
  );
  lines.push("");
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
  const narrative = formatGraphNarrativeLines(g, flat);
  if (narrative.length > 0) {
    lines.push(...narrative);
    lines.push("");
  }
  const nodes = g.nodes;
  const depth = g.maxDepth;
  const edges = g.edges;
  const hotspotCount = Array.isArray(g.hotspots) ? g.hotspots.length : 0;
  const vulnCount = Array.isArray(g.vulnerable) ? g.vulnerable.length : 0;
  const nStr =
    typeof nodes === "number" && Number.isFinite(nodes) ? String(nodes) : "—";
  const dStr =
    typeof depth === "number" && Number.isFinite(depth) ? String(depth) : "—";
  const eStr =
    typeof edges === "number" && Number.isFinite(edges) ? String(edges) : "—";
  lines.push(
    `**Counts:** ${nStr} packages · max depth ${dStr} · ${eStr} edges${hotspotCount > 0 ? ` · ${hotspotCount} hotspot${hotspotCount > 1 ? "s" : ""}` : ""}${vulnCount > 0 ? ` · ${vulnCount} flagged vulnerable` : ""}.`,
  );
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
    const title = String(rec.title ?? "Review dependencies");
    const rat = rec.rationale ? truncateWithEllipsis(rec.rationale, 400) : "";
    const pkgs =
      Array.isArray(rec.packages) && rec.packages.length > 0
        ? `\`${rec.packages.slice(0, 8).join("`, `")}\`${rec.packages.length > 8 ? ` +${rec.packages.length - 8} more` : ""}`
        : "";
    lines.push(`${i + 1}. **${title}**`);
    if (rat) {
      lines.push("");
      lines.push(rat);
    }
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
  titleLines.push(
    `# MergeSignal — ${postureLabel} · ${indexPart} (${direction})`,
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
  const out: string[] = [];
  const reasoning = result.decision?.reasoning;
  if (Array.isArray(reasoning)) {
    for (const r of reasoning) {
      const s = String(r).trim();
      if (s && !out.includes(s)) out.push(s);
      if (out.length >= max) return out;
    }
  }
  const reasons = result.explain?.reasons;
  if (Array.isArray(reasons) && out.length < max) {
    for (const r of reasons) {
      const title = String(r?.title ?? r?.id ?? "").trim();
      if (title && !out.includes(title)) out.push(title);
      if (out.length >= max) break;
    }
  }
  if (out.length === 0) {
    const one = deriveScanSummaryText(result);
    if (one) out.push(one);
  }
  return out.slice(0, max);
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

function formatDefaultWhatLine(
  item: WhatItem,
  index: number,
  opts: { firstInsightSubLine: boolean; rationaleMax: number },
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
  const title = String(rec.title ?? "Review dependencies");
  const rat = rec.rationale
    ? truncateWithEllipsis(rec.rationale, opts.rationaleMax)
    : "";
  if (rat) {
    linesOut.push(`${index}. **${title}** — ${rat}`);
  } else {
    linesOut.push(`${index}. **${title}**`);
  }
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

  if (trustedLayout) {
    lines.push(...buildTrustedTitleLines(result, flat));
    lines.push("");
  } else {
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
      for (let i = 0; i < defaultItems.length; i++) {
        const item = defaultItems[i]!;
        const firstSub = i === 0 && item.kind === "insight";
        const chunk = formatDefaultWhatLine(item, n, {
          firstInsightSubLine: firstSub,
          rationaleMax: ACTIONS_REC_RATIONALE_MAX_CHARS,
        });
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

    lines.push(buildScoreBreakdownDetails(result, flat));
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
    lines.push(buildScoreBreakdownDetails(result, flat));
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
