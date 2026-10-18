/**
 * Local Git command bound from `@mergesignal/local-git`.
 * The fulfillment timeout adds one poll/network allowance on top of that bound.
 * The session deadline is four times the governed 30s code-analysis fetch timeout:
 * one absolute cap for a responsive client, not a per-object multiple.
 */
const LOCAL_GIT_COMMAND_TIMEOUT_MS = 15_000;
const ACQUISITION_POLL_ALLOWANCE_MS = 5_000;
export const FULFILLMENT_TIMEOUT_MS =
  LOCAL_GIT_COMMAND_TIMEOUT_MS + ACQUISITION_POLL_ALLOWANCE_MS;
export const SESSION_DEADLINE_MS = 120_000;

/** Same source-byte cap as private blob admission. */
export const MAX_OBJECT_BYTES = 500_000;

export const ACQUISITION_POLL_MS = 100;
