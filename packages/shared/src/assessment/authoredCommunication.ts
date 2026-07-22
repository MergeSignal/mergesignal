import type { Assessment } from "./types.js";

/**
 * Canonical authored-communication accessors for Presentation Bundle transport.
 *
 * Both engine OutcomePresentationBundle and public ScanPresentationBundle carry
 * these fields verbatim from Expression-authored Assessment fields.
 */
export type AuthoredCommunicationAccessors = {
  /** Q6 — assessment.confidenceRationale verbatim; always present. */
  readonly trustLine: string;
  /** Q7 — assessment.reviewFocalPoint.electionSummary verbatim; null when uncontested. */
  readonly whyThisPackageLine: string | null;
  /** Q8 — assessment.notAffectedLine verbatim; null when nothing was proven unused. */
  readonly notAffectedLine: string | null;
  /** Q9 — assessment.resolutionLine verbatim; null for cleared/proven_broken. */
  readonly resolutionLine: string | null;
  /** Q1–Q5 — assessment.reasoning[] verbatim, in order. */
  readonly reasoningLines: readonly string[];
  /** Q4 — assessment.verificationScope.guidance[] verbatim; empty when absent. */
  readonly guidanceLines: readonly string[];
  /** Quantified concern context — concerns[].context values, in concern order. */
  readonly concernContextLines: readonly string[];
};

/**
 * Extract authored communication from a parsed Assessment for bundle transport.
 *
 * Copy-only: no wording logic, no markdown assembly, no intelligence derivation.
 */
export function extractAuthoredCommunication(
  assessment: Assessment,
): AuthoredCommunicationAccessors {
  return {
    trustLine: assessment.confidenceRationale,
    whyThisPackageLine: assessment.reviewFocalPoint.electionSummary ?? null,
    notAffectedLine: assessment.notAffectedLine ?? null,
    resolutionLine: assessment.resolutionLine ?? null,
    reasoningLines: assessment.reasoning,
    guidanceLines: assessment.verificationScope.guidance ?? [],
    concernContextLines: assessment.concerns
      .map((concern) => concern.context)
      .filter(
        (context): context is string =>
          context !== undefined && context.length > 0,
      ),
  };
}
