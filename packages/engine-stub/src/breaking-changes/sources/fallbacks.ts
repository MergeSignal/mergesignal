import type { BreakingChange } from "@mergesignal/shared";

/**
 * Fallback strategies when primary breaking change sources fail.
 * 
 * Implements graceful degradation:
 * 1. Changelog parsing fails → fall back to semver heuristics
 * 2. All sources fail → return conservative warning
 * 3. Rate limits hit → use cached data or provide manual override option
 */

/**
 * Error types for breaking change detection failures.
 */
export type BreakingChangeError = 
  | { type: 'network'; message: string }
  | { type: 'rate_limit'; retryAfter?: number }
  | { type: 'not_found'; resource: string }
  | { type: 'parse_error'; details: string }
  | { type: 'unknown'; error: unknown };

/**
 * Result type that includes either data or error.
 */
export type BreakingChangeResult = 
  | { success: true; changes: BreakingChange[] }
  | { success: false; error: BreakingChangeError; fallback?: BreakingChange[] };

/**
 * Create a fallback breaking change when all sources fail.
 * Returns a conservative warning to err on the side of caution.
 */
export function createFallbackWarning(
  packageName: string,
  fromVersion: string,
  toVersion: string,
  errors: BreakingChangeError[]
): BreakingChange {
  const errorTypes = errors.map(e => e.type).join(', ');
  
  return {
    source: 'manual',
    severity: 'medium',
    description: `Unable to automatically detect breaking changes for ${packageName} (${fromVersion} → ${toVersion}). Sources failed: ${errorTypes}. Manual review recommended.`,
    affectedAPIs: undefined,
  };
}

/**
 * Handle GitHub API rate limiting.
 * Provides guidance on when to retry and suggests alternatives.
 */
export function handleRateLimit(retryAfter?: number): BreakingChangeResult {
  const waitTime = retryAfter ?? 3600; // Default 1 hour
  const waitMinutes = Math.ceil(waitTime / 60);
  
  return {
    success: false,
    error: {
      type: 'rate_limit',
      retryAfter: waitTime,
    },
    fallback: [{
      source: 'manual',
      severity: 'low',
      description: `GitHub API rate limit reached. Retry in ${waitMinutes} minutes, or rely on semver heuristics.`,
    }],
  };
}

/**
 * Handle network failures with retry logic.
 */
export function handleNetworkError(
  error: unknown,
  attemptCount: number,
  maxAttempts: number = 3
): BreakingChangeResult {
  const shouldRetry = attemptCount < maxAttempts;
  const message = error instanceof Error ? error.message : String(error);
  
  return {
    success: false,
    error: {
      type: 'network',
      message: `Network error (attempt ${attemptCount}/${maxAttempts}): ${message}`,
    },
    fallback: shouldRetry ? undefined : [{
      source: 'manual',
      severity: 'low',
      description: 'Network error prevented automatic breaking change detection. Manual review recommended.',
    }],
  };
}

/**
 * Handle missing changelog or release notes.
 * Not necessarily an error - many packages don't maintain changelogs.
 */
export function handleNotFound(resource: string): BreakingChangeResult {
  return {
    success: false,
    error: {
      type: 'not_found',
      resource,
    },
    fallback: undefined, // Not found is not an error - just means no changelog available
  };
}

/**
 * Handle changelog parsing errors.
 * Falls back to semver heuristics when changelog can't be parsed.
 */
export function handleParseError(details: string): BreakingChangeResult {
  return {
    success: false,
    error: {
      type: 'parse_error',
      details,
    },
    fallback: [{
      source: 'manual',
      severity: 'low',
      description: `Changelog parsing failed: ${details}. Relying on semver heuristics.`,
    }],
  };
}

/**
 * Determine if we should retry an operation based on error type.
 */
export function shouldRetry(error: BreakingChangeError): boolean {
  switch (error.type) {
    case 'network':
      return true;
    case 'rate_limit':
      return false; // Don't retry immediately, respect rate limits
    case 'not_found':
      return false; // Resource doesn't exist, no point retrying
    case 'parse_error':
      return false; // Parse error won't fix itself
    case 'unknown':
      return true; // Conservative: retry unknown errors once
    default:
      return false;
  }
}

/**
 * Calculate exponential backoff delay for retries.
 */
export function getRetryDelay(attemptCount: number, baseDelayMs: number = 1000): number {
  return Math.min(baseDelayMs * Math.pow(2, attemptCount - 1), 30000); // Cap at 30s
}
