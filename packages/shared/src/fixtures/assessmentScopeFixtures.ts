import type {
  ArtifactGroundedVerificationScope,
  Assessment,
  FocalElectionDimension,
  ReachScope,
  ReviewEpisodeShape,
  ReviewFocalPoint,
  VerificationScope,
} from "@mergesignal/contracts";

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

export function emptyArtifactGrounded(): ArtifactGroundedVerificationScope {
  return { packages: [], focus: [], artifactPaths: [] };
}

export function artifactGroundedScopeFor(
  packages: string[],
  focus: string[] = [],
  artifactPaths: string[] = [],
): ArtifactGroundedVerificationScope {
  return { packages, focus, artifactPaths };
}

export function emptyVerificationScope(): VerificationScope {
  return {
    packages: [],
    focus: [],
    artifactGrounded: emptyArtifactGrounded(),
  };
}

export function verificationScopeFor(
  packages: string[],
  focus: string[] = [],
  artifactGrounded: ArtifactGroundedVerificationScope = emptyArtifactGrounded(),
): VerificationScope {
  return { packages, focus, artifactGrounded };
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
