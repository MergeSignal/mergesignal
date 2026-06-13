import type {
  Assessment,
  FocalElectionDimension,
  ReachScope,
  ReviewEpisodeShape,
  ReviewFocalPoint,
  VerificationScope,
} from "../assessmentSchema.js";

export function minimalReviewFocalPoint(
  anchors: string[],
  opts?: {
    episodeShape?: ReviewEpisodeShape;
    supportingPackages?: string[];
    decidedBy?: FocalElectionDimension;
  },
): ReviewFocalPoint {
  const episodeShape = opts?.episodeShape ?? "single_anchor";
  const decidedBy = opts?.decidedBy ?? "reach";
  const primary = anchors[0] ?? "dependency";
  return {
    episodeShape,
    anchors,
    supportingPackages: opts?.supportingPackages,
    election: {
      grounding: [
        {
          packageName: primary,
          reason: "fixture",
          decidedBy,
          evidenceRefs: ["fixture:focal"],
        },
      ],
      exclusions: [],
    },
  };
}

export function emptyReachScope(): ReachScope {
  return { packages: [], maxBucket: "very_low" };
}

export function reachScopeFor(
  packages: string[],
  maxBucket: ReachScope["maxBucket"] = "moderate",
): ReachScope {
  return { packages, maxBucket };
}

export function emptyVerificationScope(): VerificationScope {
  return { packages: [], focus: [] };
}

export function verificationScopeFor(
  packages: string[],
  focus: string[] = [],
): VerificationScope {
  return { packages, focus };
}

/** Attach focal/scope fields required by assessmentSchema ABI 2. */
export function withAssessmentScope(
  assessment: Omit<
    Assessment,
    "reviewFocalPoint" | "reachScope" | "verificationScope"
  >,
  scope: {
    reviewFocalPoint: ReviewFocalPoint;
    reachScope?: ReachScope;
    verificationScope?: VerificationScope;
  },
): Assessment {
  return {
    ...assessment,
    reviewFocalPoint: scope.reviewFocalPoint,
    reachScope: scope.reachScope ?? emptyReachScope(),
    verificationScope: scope.verificationScope ?? emptyVerificationScope(),
  };
}
