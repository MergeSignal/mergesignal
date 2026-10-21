/** One finite decimal. The existing threshold compares this number with PR Risk. */
const FAIL_ABOVE_SYNTAX = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

const PREPARATION_MESSAGES = {
  no_supported_dependency_change: "No supported dependency lockfile changed.",
  no_dependency_upgrade_episode:
    "No dependency upgrade was found in the supported lockfile.",
  not_a_git_repository: "This directory is not a Git repository.",
  base_required: "No comparison base is configured for this branch.",
  uncommitted_changes: "Tracked changes must be committed before scanning.",
  history_insufficient: "Git history is not sufficient to compare this change.",
  git_unavailable: "Git is not available.",
  git_read_failed: "The repository could not be read.",
} as const;

const HOSTED_MESSAGES: Record<string, string> = {
  missing_api_key: "MERGESIGNAL_API_KEY is required to run a hosted scan.",
  unauthorized: "The API key was rejected.",
  forbidden: "The hosted service refused the request.",
  entitlement_exhausted: "The analysis allowance is exhausted.",
  transient: "The hosted scan request did not complete.",
  invalid_response: "The hosted scan service returned an unusable response.",
  invalid_origin: "The API origin is not allowed.",
  bad_request: "The hosted scan request was rejected.",
  not_found: "The hosted scan was not found.",
  payload_too_large: "The hosted scan request was too large.",
  scan_failed: "The hosted scan failed.",
  scan_timed_out: "The hosted scan did not finish in time.",
  object_unavailable: "A required Git object could not be read.",
  object_oversized: "A required Git object is too large.",
  object_unsupported: "A required Git object type is not supported.",
  git_unavailable: "Git is not available.",
  git_read_failed: "The repository could not be read.",
  not_a_git_repository: "This directory is not a Git repository.",
  fulfillment_expired:
    "The Git object request expired before it could be fulfilled.",
  scan_queued: "The scan is still queued.",
  scan_running: "The scan is still running.",
  no_remembered_scan: "No completed scan is remembered for this worktree.",
  malformed_scan_reference: "The remembered scan reference is not usable.",
};

export const POINTER_NOT_SAVED =
  "The completed scan could not be remembered for later report.";

export const REPORT_API_KEY_REQUIRED =
  "MERGESIGNAL_API_KEY is required to retrieve a hosted scan.";

type PreparationOutcome = keyof typeof PREPARATION_MESSAGES;

type CliPreparationDocument = {
  kind: "cli_preparation";
  outcome: string;
  message: string;
};

type CliErrorDocument = {
  kind: "cli_error";
  code: string;
  message: string;
  limit?: number;
  used?: number;
  resetsAt?: string;
};

export function parseFailAbove(value: string): number | null {
  if (!FAIL_ABOVE_SYNTAX.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function preparationMessage(outcome: PreparationOutcome): string {
  return PREPARATION_MESSAGES[outcome];
}

export function preparationDocument(
  outcome: PreparationOutcome,
): CliPreparationDocument {
  return {
    kind: "cli_preparation",
    outcome,
    message: preparationMessage(outcome),
  };
}

export function errorDocument(
  code: string,
  message: string,
  entitlement?: { limit: number; used: number; resetsAt: string },
): CliErrorDocument {
  return {
    kind: "cli_error",
    code,
    message,
    ...(entitlement ?? {}),
  };
}

export function hostedError(failure: {
  code: string;
  limit?: number;
  used?: number;
  resetsAt?: string;
}): CliErrorDocument {
  const message =
    HOSTED_MESSAGES[failure.code] ?? "The hosted scan could not be completed.";
  if (
    failure.code === "entitlement_exhausted" &&
    typeof failure.limit === "number" &&
    typeof failure.used === "number" &&
    typeof failure.resetsAt === "string"
  ) {
    return errorDocument(failure.code, message, {
      limit: failure.limit,
      used: failure.used,
      resetsAt: failure.resetsAt,
    });
  }
  return errorDocument(failure.code, message);
}

export function interruptionCode(reason: unknown): number {
  return reason === "SIGTERM" ? 143 : 130;
}

export function interruptionDocument(): CliErrorDocument {
  return errorDocument("interrupted", "The scan was interrupted.");
}
