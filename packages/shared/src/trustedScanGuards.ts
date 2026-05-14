import type { ScanResult } from "./types.js";
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
    throw new Error(
      "trusted profile cannot render stub methodology output (engine-stub)",
    );
  }
}

/**
 * Validates scan JSON after a trusted analysis run (CLI / worker boundary).
 */
export function assertTrustedScanResult(result: ScanResult): void {
  if (isStubMethodologyVersion(result.methodologyVersion)) {
    throw new Error(
      "Trusted analysis rejected engine-stub methodologyVersion output",
    );
  }
  const mv = result.methodologyVersion?.trim();
  if (!mv) {
    throw new Error("Trusted analysis requires a non-empty methodologyVersion");
  }
  const prefix = String(
    process.env.MERGESIGNAL_TRUSTED_METHODOLOGY_PREFIX ?? "",
  ).trim();
  if (prefix && !mv.startsWith(prefix)) {
    throw new Error(
      `Trusted analysis: methodologyVersion must start with configured prefix (set MERGESIGNAL_TRUSTED_METHODOLOGY_PREFIX only when required)`,
    );
  }
}

export type TrustedActionsAuditResult =
  | { ok: true }
  | { ok: false; errors: readonly string[] };

/**
 * Post-render audit for trusted Actions: methodology + explicit wording only.
 */
export function auditTrustedActionsOutput(opts: {
  summaryText: string;
  scanResult: ScanResult;
  /** When true, require MERGESIGNAL_TRUSTED_ANALYSIS=1 in process.env. */
  requireTrustedEnv?: boolean;
}): TrustedActionsAuditResult {
  const errors: string[] = [];

  if (
    opts.requireTrustedEnv &&
    process.env.MERGESIGNAL_TRUSTED_ANALYSIS !== "1"
  ) {
    errors.push("Expected MERGESIGNAL_TRUSTED_ANALYSIS=1 for trusted audit");
  }

  try {
    assertTrustedScanResult(opts.scanResult);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  const text = opts.summaryText;
  for (const phrase of trustedActionsSummaryDenylistPhrases()) {
    if (phrase && text.includes(phrase)) {
      errors.push(
        `Trusted Actions summary contains forbidden phrase: ${JSON.stringify(phrase.slice(0, 80))}`,
      );
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
