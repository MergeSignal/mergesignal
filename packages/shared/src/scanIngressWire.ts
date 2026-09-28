import type { AnalysisContextWarning } from "./types.js";
import type { ScanLockfileInput } from "./types.js";
import type { ScanDetailsPresentation } from "./presentation/dto/scanDetailsPresentation.js";

/** Governed repository/change acquisition intent (wire + queue orchestration). */
export type ScanChangeIntent = "change_request" | "repository_scope";

/** Repository revision reference — provider-neutral, JSON-safe. */
export type ScanRevisionRef = {
  ref?: string;
  sha: string;
};

/**
 * Provider-neutral repository/change facts for hosted scan ingress.
 * No filesystem paths, provider transport, source corpus, or engine semantics.
 */
export type SerializableScanAcquiredFacts = {
  repoId: string;
  changeIntent: ScanChangeIntent;
  headRevision: ScanRevisionRef;
  baseRevision?: ScanRevisionRef;
  lockfileAtHead?: ScanLockfileInput;
  lockfileAtBase?: ScanLockfileInput;
  changedPaths?: string[];
  changedManifestPaths?: string[];
  dependencyGraph?: unknown;
  acquisitionWarnings?: AnalysisContextWarning[];
};

/** Current repository evidence envelope schema version. */
export const REPOSITORY_EVIDENCE_SCHEMA_VERSION = 1 as const;

export type RepositoryEvidenceSchemaVersion =
  typeof REPOSITORY_EVIDENCE_SCHEMA_VERSION;

/**
 * Client-reported acquisition metadata. Not authoritative for quota/security;
 * server must validate retrieved evidence independently.
 */
export type RepositoryCorpusAcquisitionSummary = {
  filesIncluded: number;
  filesSkippedPolicy: number;
  filesSkippedSize: number;
  filesSkippedBinary: number;
  totalBytes: number;
  truncated: boolean;
  /** Set when ignore rules could not be fully applied (e.g. git unavailable). */
  corpusIgnorePolicyPartial?: boolean;
};

/**
 * Versioned provider-neutral source evidence passed in-memory to private ingress
 * after worker retrieval. No storage-provider fields.
 */
export type RepositoryEvidenceEnvelope = {
  schemaVersion: RepositoryEvidenceSchemaVersion;
  files: Record<string, string>;
  /** Client-reported summary; must not be trusted without envelope validation. */
  reportedAcquisitionSummary: RepositoryCorpusAcquisitionSummary;
};

/** Pre-engine operational outcome kinds (not Assessment). */
export const SCAN_OPERATIONAL_OUTCOME_KINDS = [
  "no_dependency_upgrade_episode",
  "change_context_unavailable",
  "scan_preparation_failed",
] as const;

export type ScanOperationalOutcomeKind =
  (typeof SCAN_OPERATIONAL_OUTCOME_KINDS)[number];

/**
 * Public operational scan outcome — structurally distinct from Assessment.
 * Must never encode merge posture or engine decision authority.
 */
export type ScanOperationalOutcome = {
  kind: ScanOperationalOutcomeKind;
  scanId: string;
  repoId: string;
  explanationCode: string;
  message: string;
  warnings?: AnalysisContextWarning[];
};

/** Governed machine response for CLI, MCP, and applicable API terminal reads. */
export type GovernedScanProductResponse =
  | {
      kind: "operational";
      outcome: ScanOperationalOutcome;
    }
  | {
      kind: "analysis_complete";
      scanId: string;
      detailPresentation: ScanDetailsPresentation;
    };
