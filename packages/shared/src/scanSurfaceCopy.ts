/**
 * Single source for short scan pipeline / Actions copy (not i18n — keep flat and small).
 * Risk / merge posture labels stay in riskVocabulary / MERGE_POSTURE_LABEL.
 */

export const scanSurfaceCopy = {
  pipeline: {
    scanRunning: "Scan in progress",
    scanIncomplete: "Waiting for scan results",
    scanUnavailable: "Scan data unavailable",
    analysisIncomplete: "Analysis could not be completed",
    outputNotVerified: "These results could not be verified",
  },
  actions: {
    failureTitle: "MergeSignal",
    failureBody:
      "Analysis could not be completed. Check the workflow logs for details.",
    demoSummaryTitle: "MergeSignal (demo output)",
    demoSummaryBanner:
      "Sample analysis only — not production MergeSignal results. Do not use for merge decisions.",
    trustedSummaryMethodologyLine: "Methodology",
    /** Dogfood workflow: secret missing on same-repo runs (annotation + logs). */
    trustedWorkflowSecretMissing:
      "Trusted MergeSignal analysis is unavailable in this repository. Complete engine access setup, then re-run the workflow.",
    /** Composite: trusted profile without engine token input. */
    trustedCompositeTokenMissing:
      "Trusted analysis is unavailable: engine access was not provided to this workflow run.",
    trustedEngineRepoLayoutInvalid:
      "MergeSignal could not prepare the analysis engine (unsupported project layout).",
    trustedEngineBuildOutputMissing:
      "MergeSignal could not prepare the analysis engine (expected build output was not found).",
    /** Stub methodology or trusted summary preflight. */
    trustedSummaryStubBlocked:
      "Trusted analysis is unavailable: output did not meet verification requirements.",
    trustedMethodologyMissing:
      "Trusted analysis is unavailable: verified analysis metadata was missing.",
    trustedMethodologyPolicyMismatch:
      "Trusted analysis is unavailable: methodology output did not match the configured policy.",
    trustedAuditEnvInvalid:
      "Trusted analysis verification could not run in this environment.",
    /** Post-render audit: summary text failed trusted verification. */
    trustedSummaryVerificationFailed:
      "MergeSignal could not verify this summary for trusted analysis.",
    prAnalysisUnavailableFork:
      "MergeSignal analysis is not available for this pull request (fork PRs use a restricted CI context).",
    prAnalysisUnavailableDependabot:
      "MergeSignal analysis is not available for automated dependency update PRs in this CI context.",
    /** push/workflow_dispatch on a clone with no engine token configured (forks/mirrors). */
    pushTrustedScanSkippedNoEngineToken:
      "Trusted MergeSignal analysis was skipped because no engine access token is configured for this repository.",
    /** Step summary when trusted scan cannot start (canonical repo, token missing). */
    trustedWorkflowCredentialHintBody:
      "The engine checkout token was not available to this workflow run. Add it under this repository's Actions secrets, or grant this repository access to an organization secret. Secrets that exist only on a GitHub Environment are not available here unless this job declares that environment.",
    /** Trusted step summary H1 product line (before posture · risk index). */
    trustedStepSummaryTitlePrefix: "MergeSignal dependency review",
    /** GitHub Actions step summary: risk index direction (shared with web/CLI where imported). */
    riskIndexDirectionShort: "0 = lowest merge risk, 100 = highest merge risk",
    /** When `decision` is missing on scan JSON (legacy output). */
    mergePostureUnavailableShort: "Posture unavailable",
    mergePostureUnavailableDetail:
      "This scan did not include a merge posture verdict; use the risk index as a coarse signal only.",
    /** `<summary>` lines for collapsible sections (keep short for GitHub UI). */
    scoreBreakdownDetailsSummary: "Layer scores — this scan",
    dependencyGraphDetailsSummary: "Graph context",
    moreActionsDetailsSummary: "More guidance",
    moreInsightsDetailsSummary: "More insights",
    /** Inside dependency graph `<details>`. */
    supportingGraphContextNote:
      "Supporting context — not a merge verdict by itself.",
    layerScoreGlossary:
      "*Higher column scores = more risk in that dimension (0 best → 100 worst).*",
    /** After layer table: scan-specific drivers from explain/contributions. */
    layerDriversHeading: "Signals behind elevated scores",
    /** When surfacing recommendation rationale first (trusted default fold). */
    recReviewLeadPrefix: "**For this PR:**",
    vulnerableReviewerHint:
      "If vulnerable packages are listed, confirm they apply to your usage before treating counts as merge blockers.",
    /** Development profile: no recommendations or actionable insights. */
    devNoImmediateActions: "No immediate actions required",
  },
  /** GitHub App Check Run (PR) — calm, concise; not Actions step summary. */
  checkRun: {
    titleBase: "MergeSignal scan - PR dependency change",
    titleBaselineSuffix: "baseline scan only",
    baselineOutcomePrimary:
      "No actionable dependency concerns showed up for this PR in this scan.",
    baselineOutcomeScope:
      "This run emphasizes repository-wide context; open the scan for PR-specific detail when available.",
    baselineBoundaryNote:
      "PR-targeted dependency signals are not included in baseline-only runs.",
    footerLinkLabel: "View full scan",
    layerScoresDetailsSummary: "Layer scores",
    layerNoDrivers: "No notable drivers surfaced for this dimension.",
    repoContextLabel: "Risk index",
    mergePostureUnavailable: "Posture unavailable",
  },
  product: {
    /** Single line for UI/CLI/Actions parity (risk index semantics). */
    riskIndexDirectionShort: "0 is best · 100 is worst",
  },
  cli: {
    stderrAnalysisIncomplete: "Analysis could not be completed.",
    stderrOutputNotVerified: "These results could not be verified.",
  },
  /** @mergesignal/engine loader (stderr / thrown when impl missing). */
  engineLoader: {
    implRequiredTrustedScan:
      "Trusted analysis requires a configured analysis engine. Use demo output only when you explicitly intend to run without a real engine.",
    implRequiredProduction:
      "A configured analysis engine is required in this environment. Use demo output only when you explicitly intend to run without a real engine.",
  },
} as const;

/** Flatten for `scripts/ci/*.mjs` consumers (generated JSON). */
export function scanSurfaceCopyFlat(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (prefix: string, obj: unknown) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "string") out[key] = v;
        else walk(key, v);
      }
    }
  };
  walk("", scanSurfaceCopy);
  return out;
}
