/**
 * Assessment wire ABI — canonical authority for MergeSignal public Assessment contracts.
 * Bump only on incompatible Assessment wire shape changes.
 *
 * ABI 4: adds optional outcome model fields (outcome, perPackageOutcome,
 * clearanceEnvelopes, boundedVerifyTargets, evidenceSufficiencyVerdict, abstainReasons).
 * Backward-compatible: all new fields are optional; ABI 3 payloads remain valid.
 */
export const ASSESSMENT_ABI = "4" as const;

export type AssessmentAbi = typeof ASSESSMENT_ABI;
