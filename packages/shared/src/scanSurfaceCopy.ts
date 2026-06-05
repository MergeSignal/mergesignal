/**
 * Single source for short scan pipeline / Actions copy (not i18n - keep flat and small).
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
      "Sample analysis only - not production MergeSignal results. Do not use for merge decisions.",
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
    /** Trusted step summary H1 product line (before posture  |  risk index). */
    trustedStepSummaryTitlePrefix: "MergeSignal dependency review",
    /** GitHub Actions step summary: risk index direction (shared with web/CLI where imported). */
    riskIndexDirectionShort: "0 = lowest merge risk, 100 = highest merge risk",
    /** When `decision` is missing on scan JSON (legacy output). */
    mergePostureUnavailableShort: "Posture unavailable",
    mergePostureUnavailableDetail:
      "This scan did not include a merge posture verdict; use the risk index as a coarse signal only.",
    /** `<summary>` lines for collapsible sections (keep short for GitHub UI). */
    scoreBreakdownDetailsSummary: "Layer scores - this scan",
    dependencyGraphDetailsSummary: "Graph context",
    moreActionsDetailsSummary: "More guidance",
    moreInsightsDetailsSummary: "More insights",
    /** Inside dependency graph `<details>`. */
    supportingGraphContextNote:
      "Supporting context - not a merge verdict by itself.",
    layerScoreGlossary:
      "*Higher column scores = more risk in that dimension (0 best ??? 100 worst).*",
    /** After layer table: scan-specific drivers from explain/contributions. */
    layerDriversHeading: "Signals behind elevated scores",
    /** When surfacing recommendation rationale first (trusted default fold). */
    recReviewLeadPrefix: "**For this PR:**",
    vulnerableReviewerHint:
      "If vulnerable packages are listed, confirm they apply to your usage before treating counts as merge blockers.",
    /** Development profile: no recommendations or actionable insights. */
    devNoImmediateActions: "No immediate actions required",
  },
  /** GitHub App Check Run (PR) - calm, concise; not Actions step summary. */
  checkRun: {
    titleBase: "PR dependency change",
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
    riskIndexDirectionShort: "0 is best | 100 is worst",
  },
  /** Scan detail page (`/scan/[id]`) - show-don't-teach reviewer copy. */
  scanDetail: {
    recommendedActionsHeading: "Recommended actions",
    signalSummaryHeading: "Signal summary",
    upgradeContextHeading: "Upgrade context",
    codeIntelligenceUnavailable:
      "Application usage was not analyzed for this scan",
    /** @deprecated Use signalSummaryHeading */
    riskSummaryHeading: "Signal summary",
    operationalImpactHeading: "What this upgrade may affect",
    whyVerdictHeading: "Why this verdict",
    proofHeading: "Proof",
    nextStepsHeading: "Recommended next steps",
    topologySummary: "Dependency topology",
    topologyCollapsedHint: "Supporting detail - graph paths and depth",
    whereLabel: "Where",
    verifyLabel: "Verify",
    moreImpactsSummary: "More impacts",
    moreRecommendationsSummary: "More recommendations",
    moreFindingsSummary: "More findings",
    reachChip: {
      focused: "Focused reach",
      limited: "Limited reach",
      moderate: "Moderate reach",
      wide: "Wide reach",
    },
    verdictLine: {
      safeNoBlockersNarrow: "No merge blockers - narrow footprint",
      safeNoBlockersModerate:
        "No merge blockers - moderate dependency footprint",
      safeNoBlockersWide: "No merge blockers - wide upgrade footprint",
      reviewBeforeMergeNarrow: "Review before merge - narrow footprint",
      reviewBeforeMergeModerate:
        "Review before merge - moderate dependency footprint",
      reviewBeforeMergeWide: "Review before merge - wide dependency footprint",
      riskyResolveNarrow: "Resolve blockers before merge - focused footprint",
      riskyResolveModerate:
        "Resolve blockers before merge - moderate dependency footprint",
      riskyResolveWide: "Resolve blockers before merge - wide transitive tree",
    },
    tier1Fallback: {
      /** Graph-only / lightweight PR baseline (pattern F3). */
      lightweightPr:
        "This PR has limited code-change signal. MergeSignal reviewed dependency structure; no runtime-impact indicators detected.",
      /** Actionable structural redirect (pattern F4). */
      structuralProofBelow:
        "No runtime-impact indicators detected. Dependency risks, if any, are listed in proof below.",
      /** Quiet safe (pattern Q). */
      quietSafe: "No application-level impact identified.",
      /** Structural assessment completed (pattern F1). */
      structuralComplete:
        "Dependency structure assessed. No application-specific behavior changes identified for this PR.",
    },
    confidenceCaveat: {
      medium: "Based on partial dependency signal",
      low: "Limited signal - treat this as directional",
    },
    codeAnalysisTimeout:
      "Code analysis timed out - runtime impact may be incomplete",
    scanPipelineNote: "This page updates automatically.",
    recommendationDetail: {
      selectPrompt: "Select a recommendation to understand it",
      whyLabel: "Why",
      whyNowLabel: "Why now",
      signalsLabel: "Signals behind this recommendation",
      affectedPackagesLabel: "Affected packages",
      expectedBenefitLabel: "Expected benefit",
      defaultWhy:
        "This recommendation addresses a structural dependency pattern detected in this scan.",
      defaultWhyNow:
        "This scan surfaced dependency patterns worth addressing before or after merge.",
      defaultBenefit: "Reduced merge risk and easier dependency management.",
      insightBenefit:
        "Restores predictable runtime behavior and prevents regressions after merge.",
      securityFindingBenefit:
        "Reduced vulnerability exposure before code reaches production.",
      coveredByRecommendation: "Covered in recommended action",
    },
    recommendationScanContext: {
      quietSafe:
        "MergeSignal reviewed this upgrade. No merge blockers or runtime-impact indicators detected.",
      needsReview:
        "MergeSignal reviewed dependency structure for this upgrade. Review the items below before merging.",
      risky:
        "MergeSignal detected blockers in this upgrade. Resolve the priorities below before merging.",
      lightweightGraph:
        "This PR has limited code-change signal. MergeSignal reviewed dependency structure for structural risks.",
    },
    recommendationPriority: {
      high: "High Priority",
      medium: "Medium Priority",
      low: "Low Priority",
    },
    /** @deprecated Use recommendationPriority */
    guidanceUrgency: {
      beforeMerge: "High Priority",
      recommended: "Medium Priority",
      monitor: "Low Priority",
    },
    guidancePlaybook: {
      mergeNormally: "Merge normally",
      scheduleCleanup: "Schedule routine dependency cleanup",
      continueMonitoring: "Continue monitoring dependency health",
      mergeAfterVerification: "Merge after verifying affected paths",
      reviewBeforeMerge: "Review dependency risks before merging",
      reviewDependencyStructure: "Review dependency structure before merging",
      reviewAffectedPaths: "Review affected dependency paths",
      monitorTransitiveChanges: "Monitor transitive changes after merge",
      riskyResolveBeforeMerge: "Resolve blockers before merging",
      riskyReviewVulnerable: "Review vulnerable transitive packages",
      riskyRerunAfterFixes: "Re-run scan after fixes",
      resolveCriticalBeforeMerge: "Resolve critical findings before merge",
    },
    recommendationPlaybookDetail: {
      mergeNormally: {
        why: "Dependency structure looks stable for this upgrade scope.",
        whyNow:
          "No merge blockers or runtime-impact indicators were detected for this PR.",
        expectedBenefit: "Low-friction merge with minimal follow-up work.",
        signals: [
          "No merge blockers detected",
          "Dependency structure reviewed",
        ],
      },
      scheduleCleanup: {
        why: "Even quiet upgrades accumulate semver drift over time.",
        whyNow:
          "Proactive cleanup keeps future upgrades cheaper as the tree evolves.",
        expectedBenefit:
          "Easier dependency management on the next upgrade cycle.",
        signals: ["Routine maintenance opportunity"],
      },
      continueMonitoring: {
        why: "Dependency health is stable now but benefits from ongoing observation.",
        whyNow: "Monitoring catches regressions that appear only after merge.",
        expectedBenefit:
          "Earlier detection of dependency regressions in production.",
        signals: ["No immediate blockers - monitor after merge"],
      },
      mergeAfterVerification: {
        why: "Wide upgrade footprints warrant a quick sanity check before merge.",
        whyNow:
          "This upgrade touches enough packages to validate affected paths once.",
        expectedBenefit:
          "More predictable merges with fewer surprise runtime interactions.",
        signals: ["Wide upgrade footprint detected"],
      },
      reviewBeforeMerge: {
        why: "Structural dependency signals warrant a focused review before merge.",
        whyNow:
          "This scan surfaced dependency risks that deserve a pre-merge pass.",
        expectedBenefit:
          "Lower chance of shipping hidden dependency regressions.",
        signals: ["Elevated dependency review recommended"],
      },
      reviewDependencyStructure: {
        why: "Limited code-change signal means dependency structure carries most of the review burden.",
        whyNow:
          "MergeSignal reviewed the lockfile graph because PR code signal was lightweight.",
        expectedBenefit:
          "Confidence that structural changes are understood before merge.",
        signals: ["Graph-based structural review completed"],
      },
      reviewAffectedPaths: {
        why: "Transitive paths can hide behavior changes behind a small direct diff.",
        whyNow:
          "Affected dependency paths in this scan exceed a narrow footprint.",
        expectedBenefit:
          "Clearer understanding of what this upgrade actually touches.",
        signals: ["Multiple affected dependency paths"],
      },
      monitorTransitiveChanges: {
        why: "Transitive changes can surface only after merge in integrated environments.",
        whyNow:
          "This upgrade shifts transitive dependencies that are worth watching post-merge.",
        expectedBenefit:
          "Earlier detection if transitive changes cause regressions.",
        signals: ["Transitive dependency shift detected"],
      },
      riskyResolveBeforeMerge: {
        why: "Blockers must be resolved before this upgrade is safe to merge.",
        whyNow: "This scan flagged issues that exceed acceptable merge risk.",
        expectedBenefit: "Safer merge with blockers addressed before release.",
        signals: ["Merge blockers detected"],
      },
      riskyReviewVulnerable: {
        why: "Known vulnerabilities in the dependency tree can reach production through this upgrade.",
        whyNow:
          "Vulnerable packages are reachable from packages changed in this PR.",
        expectedBenefit:
          "Reduced vulnerability exposure before code reaches production.",
        signals: ["Vulnerable transitive packages detected"],
      },
      riskyRerunAfterFixes: {
        why: "Fixes can change the dependency graph and scan conclusions.",
        whyNow:
          "Re-run after addressing blockers to confirm the upgrade is safe.",
        expectedBenefit: "Verified merge posture after remediation.",
        signals: ["Re-scan recommended after fixes"],
      },
      resolveCriticalBeforeMerge: {
        why: "Critical or high-severity findings block a safe merge posture.",
        whyNow:
          "This scan flagged findings that must be addressed before merge.",
        expectedBenefit: "Safer merge with critical issues resolved first.",
        signals: ["High-severity findings detected"],
      },
    },
    signalSummary: {
      scoreCaption: "Dependency signal score",
      layersHeading: "Layer signals",
      gaugeAriaLabel: "Dependency signal score {score} - {band}",
      followUpImprovementIdentified: "1 follow-up improvement was identified",
      followUpImprovementsIdentified:
        "{count} follow-up improvements were identified",
      bandLabel: {
        low: "Low",
        moderate: "Moderate",
        high: "Elevated",
      },
      signalLabel: {
        low: "Low",
        medium: "Moderate",
        high: "Elevated",
      },
    },
  },
  /** PR narrative presentation - channel-specific copy built from ScanNarrativeFacts. */
  narrativeCard: {
    structuralOnlyDisclaimer: "Structural dependency analysis only",
    runtimeSurface: {
      runtime: "Runtime",
      build: "Build-only",
      test: "Test-only",
      unknown: "Unknown surface",
    },
    reachability: {
      on_runtime_paths: "On runtime paths",
      build_only: "Build-only",
      test_only: "Test-only",
      unreachable: "Not on runtime paths",
      unknown: "Reachability unknown",
    },
    blastRadius: {
      narrow: "Narrow",
      moderate: "Moderate",
      wide: "Wide",
    },
    areasSeparator: " | ",
    contextSeparator: " | ",
  },
  /** Shared presentation layer copy (composeHeadline, key points, verification). */
  presentation: {
    limitedContextHeadline: "Dependency upgrade with limited scan context",
    limitedContextMessage: "PR-specific scan context was limited",
    limitedContextKeyPoint:
      "PR-specific intelligence was limited for this scan",
    noChangedPackagesHeadline: "Dependency scan complete",
    multiRuntimeHeadline: "Multiple runtime dependency upgrades need review",
    buildOnlyHeadline:
      "{package} patch upgrade with limited application impact",
    runtimeHeadline: "{package} upgrade affects {surface}",
    toolingPatchHeadline: "{package} patch upgrade",
    toolingUpgradeHeadline: "{package} tooling upgrade",
    runtimeUpgradeHeadline: "{package} runtime upgrade affects {surface}",
    safeNeutralHeadline: "{package} dependency upgrade",
    defaultUpgradeHeadline: "{package} dependency upgrade needs review",
    changedPackageKeyPoint: "Changed package: {package}",
    usedInPathsSingle: "Used across application code ({path})",
    usedInPathsMultiple: "Used across {count} code paths",
    noRuntimePathsKeyPoint: "No runtime usage paths detected",
    expectedImpactLimitedKeyPoint: "Expected impact is limited to {workflows}",
    limitedEvidenceKeyPoint: "Evidence for this upgrade is limited",
    usedInRuntimePathsKeyPoint: "Used in runtime application paths",
    runtimeUsageKeyPoint: "Used in runtime application paths",
    blastRadiusWideKeyPoint: "Blast radius is wide",
    blastRadiusLevelKeyPoint: "Blast radius is {level}",
    noAffectedAreasKeyPoint: "No affected application areas identified",
    affectedAreasKeyPoint: "Affected areas: {areas}",
    verifyCiTypecheck: "Confirm CI/typecheck passes",
    verifyAuthFlow: "Run authenticated API request flow",
    verifyErrorResponses: "Check error responses and status codes",
    graphDepthContext: "Repository graph max depth: {depth}",
    graphSizeContext: "Repository graph: {nodes} nodes, {edges} edges",
    actionLabelReview: "Review scan",
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
