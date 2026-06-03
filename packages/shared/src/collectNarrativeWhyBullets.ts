import { deriveScanSummaryText } from "./deriveScanSummaryText.js";
import {
  humanizeEngineSurfaceText,
  truncateWithEllipsis,
} from "./actionsStepSummary.js";
import {
  composeContextLineFromFacts,
  formatBlastRadiusDetailLine,
  formatUsageSummaryLine,
  labelReachabilityKind,
  selectReviewerGuidance,
} from "./narrativePresentation.js";
import { normalizeGeneratedText } from "./normalizeGeneratedText.js";
import type { ScanNarrativeFacts } from "./scanNarrativeFacts.js";
import type { ScanResult } from "./types.js";

function pushUnique(out: string[], line: string, max: number): void {
  const t = normalizeGeneratedText(line.trim());
  if (!t || out.includes(t)) return;
  out.push(t);
  if (out.length > max) out.length = max;
}

/**
 * Why bullets from narrative facts (tier-1/tier-2). Preferred for GitHub + Actions.
 */
export function collectWhyBulletsFromFacts(
  facts: ScanNarrativeFacts,
  max: number,
): string[] {
  const prIntel =
    facts.availability.mode === "pr_intelligence" ||
    facts.availability.tiersPresent.tier1;
  if (!prIntel) return [];

  const out: string[] = [];

  if (prIntel) {
    const context = composeContextLineFromFacts(facts, {
      includePathSample: true,
      maxAreas: 2,
    });
    if (context) pushUnique(out, context, max);

    const usage = formatUsageSummaryLine(facts, 1);
    if (usage) pushUnique(out, usage, max);

    const blast = formatBlastRadiusDetailLine(facts, 2);
    if (blast) pushUnique(out, blast, max);

    for (const area of facts.affectedAreas) {
      if (out.length >= max) break;
      pushUnique(out, area.label, max);
    }

    const reach = labelReachabilityKind(facts);
    if (reach) pushUnique(out, reach, max);
  }

  if (out.length < max) {
    for (const g of selectReviewerGuidance(facts, { max: max - out.length })) {
      if (out.length >= max) break;
      pushUnique(out, truncateWithEllipsis(g.message.trim(), 200), max);
    }
  }

  return out.slice(0, max);
}

/**
 * Legacy why bullets from raw ScanResult (fallback when facts are thin).
 */
export function collectWhyBulletsFromResult(
  result: ScanResult,
  max: number,
): string[] {
  const out: string[] = [];
  const reasoning = result.decision?.reasoning;
  if (Array.isArray(reasoning)) {
    for (const r of reasoning) {
      const s = humanizeEngineSurfaceText(String(r).trim());
      if (s) pushUnique(out, s, max);
      if (out.length >= max) return out.slice(0, max);
    }
  }
  const reasons = result.explain?.reasons;
  if (Array.isArray(reasons) && out.length < max) {
    for (const r of reasons) {
      const title = String(r?.title ?? r?.id ?? "").trim();
      const readable = humanizeEngineSurfaceText(title);
      if (readable) pushUnique(out, readable, max);
      if (out.length >= max) break;
    }
  }
  if (out.length === 0) {
    const one = deriveScanSummaryText(result);
    if (one) pushUnique(out, one, max);
  }
  return out.slice(0, max);
}

export function collectWhyBullets(
  facts: ScanNarrativeFacts,
  result: ScanResult,
  max: number,
): string[] {
  const fromFacts = collectWhyBulletsFromFacts(facts, max);
  if (fromFacts.length >= max) return fromFacts;
  if (
    facts.availability.mode === "pr_intelligence" ||
    facts.availability.tiersPresent.tier1
  ) {
    return fromFacts;
  }
  const legacy = collectWhyBulletsFromResult(result, max);
  if (fromFacts.length === 0) return legacy;
  const merged = [...fromFacts];
  for (const line of legacy) {
    pushUnique(merged, line, max);
    if (merged.length >= max) break;
  }
  return merged.slice(0, max);
}
