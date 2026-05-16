import { parseEngineOutputScanResultOrThrow } from "./scanResultSchema.js";
import type { EngineEmittedScanResult, ScanResult } from "./types.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";

const STUB_METHODOLOGY = /^engine-stub\//i;

/** True when methodology is tagged as the OSS stub engine. */
export function isStubMethodologyVersion(
  methodologyVersion: string | undefined,
): boolean {
  return (
    methodologyVersion != null &&
    STUB_METHODOLOGY.test(String(methodologyVersion).trim())
  );
}

/**
 * Substrings that must not appear in a trusted GitHub Actions step summary.
 * Keep literals short and tied to product copy — no dependency-name heuristics.
 */
export function trustedActionsSummaryDenylistPhrases(): readonly string[] {
  return [
    scanSurfaceCopy.actions.demoSummaryTitle,
    scanSurfaceCopy.actions.demoSummaryBanner,
    "engine-stub/",
    "engine-stub/v2",
  ] as const;
}

/**
 * Refuse to render a trusted Actions summary when methodology is stub-tagged.
 * Mirrors legacy render script behavior; use from CLI and CI renderer.
 */
export function assertTrustedActionsSummaryAllowed(
  profile: string,
  methodologyVersion: string | undefined,
): void {
  const p = String(profile ?? "").trim();
  if (p !== "trusted") return;
  if (isStubMethodologyVersion(methodologyVersion)) {
    throw new Error(scanSurfaceCopy.actions.trustedSummaryStubBlocked);
  }
}

/**
 * Validates scan JSON after a trusted analysis run (CLI / worker boundary).
 */
export function assertTrustedScanResult(result: ScanResult): void {
  if (isStubMethodologyVersion(result.methodologyVersion)) {
    throw new Error(scanSurfaceCopy.actions.trustedSummaryStubBlocked);
  }
  const mv = result.methodologyVersion?.trim();
  if (!mv) {
    throw new Error(scanSurfaceCopy.actions.trustedMethodologyMissing);
  }
  const prefix = String(
    process.env.MERGESIGNAL_TRUSTED_METHODOLOGY_PREFIX ?? "",
  ).trim();
  if (prefix && !mv.startsWith(prefix)) {
    throw new Error(scanSurfaceCopy.actions.trustedMethodologyPolicyMismatch);
  }
}

/**
 * Strict structural validation for fresh engine JSON + trusted policy.
 * Do not pass historical `scans.result` rows (may omit methodology).
 */
export function validateTrustedEngineScanResult(
  raw: unknown,
): EngineEmittedScanResult {
  const result = parseEngineOutputScanResultOrThrow(raw);
  assertTrustedScanResult(result);
  return result;
}

export type TrustedActionsAuditResult =
  | { ok: true }
  | { ok: false; errors: readonly string[] };

/**
 * Post-render audit for trusted Actions: methodology + explicit wording only.
 */
export function auditTrustedActionsOutput(opts: {
  summaryText: string;
  /** Raw scan JSON (e.g. from disk); validated with strict engine-output schema + trusted policy. */
  scanResult: unknown;
  /** When true, require trusted-analysis mode in process.env for this audit. */
  requireTrustedEnv?: boolean;
}): TrustedActionsAuditResult {
  const errors: string[] = [];

  if (
    opts.requireTrustedEnv &&
    process.env.MERGESIGNAL_TRUSTED_ANALYSIS !== "1"
  ) {
    errors.push(scanSurfaceCopy.actions.trustedAuditEnvInvalid);
  }

  let scanResult: ScanResult | undefined;
  try {
    scanResult = validateTrustedEngineScanResult(opts.scanResult);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  if (scanResult) {
    const text = opts.summaryText;
    let denylistHit = false;
    for (const phrase of trustedActionsSummaryDenylistPhrases()) {
      if (phrase && text.includes(phrase)) {
        denylistHit = true;
        break;
      }
    }
    if (denylistHit) {
      errors.push(scanSurfaceCopy.actions.trustedSummaryVerificationFailed);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
