import type {
  ScanRequest,
  UpgradeSimulationRequest,
} from "@mergesignal/shared";
import {
  isStubMethodologyVersion,
  validateTrustedEngineScanResult,
} from "@mergesignal/shared";
import { defaultEngineStartupTimeoutMs, withTimeout } from "./withTimeout.js";

/** Minimal scan input for startup ABI validation — must stay lightweight (no I/O). */
export const ABI_PROBE_SCAN_REQUEST: ScanRequest = {
  repoId: "__mergesignal_engine_abi_probe__",
  dependencyGraph: {},
};

/** Minimal upgrade input for startup ABI validation — must stay lightweight (no I/O). */
export const ABI_PROBE_UPGRADE_REQUEST: UpgradeSimulationRequest = {
  repoId: "__mergesignal_engine_abi_probe__",
  currentLockfile: {
    manager: "pnpm",
    content: "lockfileVersion: '9.0'\n",
    path: "pnpm-lock.yaml",
  },
  target: {
    packageName: "__abi_probe__",
    targetVersion: "0.0.0",
  },
};

export type EngineAbiValidationResult = {
  ok: true;
  methodologyVersion: string;
  probeDurationMs: number;
};

export type ValidateEngineAbiOptions = {
  timeoutMs?: number;
};

async function validateEngineAbiInner(
  spec: string,
): Promise<EngineAbiValidationResult> {
  const started = Date.now();
  const mod = (await import(spec)) as Record<string, unknown>;
  const analyzeFn = mod.analyze;
  const simulateUpgradeFn = mod.simulateUpgrade;

  if (typeof analyzeFn !== "function") {
    throw new Error(`Engine module ${spec} does not export analyze function`);
  }
  if (typeof simulateUpgradeFn !== "function") {
    throw new Error(
      `Engine module ${spec} does not export simulateUpgrade function`,
    );
  }

  const analyze = analyzeFn as (req: ScanRequest) => Promise<unknown>;
  const simulateUpgrade = simulateUpgradeFn as (
    req: UpgradeSimulationRequest,
  ) => Promise<unknown>;

  const rawScan = await analyze(ABI_PROBE_SCAN_REQUEST);
  const validated = validateTrustedEngineScanResult(rawScan);

  if (isStubMethodologyVersion(validated.methodologyVersion)) {
    throw new Error(
      "Engine ABI validation rejected stub methodology in production engine",
    );
  }

  const rawUpgrade = await simulateUpgrade(ABI_PROBE_UPGRADE_REQUEST);
  if (
    !rawUpgrade ||
    typeof rawUpgrade !== "object" ||
    !("before" in rawUpgrade) ||
    !("after" in rawUpgrade) ||
    !("delta" in rawUpgrade) ||
    !("generatedAt" in rawUpgrade)
  ) {
    throw new Error(
      "Engine module simulateUpgrade did not return expected UpgradeSimulationResult shape",
    );
  }

  return {
    ok: true,
    methodologyVersion: validated.methodologyVersion!,
    probeDurationMs: Date.now() - started,
  };
}

/**
 * Runtime ABI validation between the public platform and a configured engine module.
 * Intended for build smoke and one-time worker startup preflight — never per-scan.
 */
export async function validateEngineAbi(
  spec: string,
  options: ValidateEngineAbiOptions = {},
): Promise<EngineAbiValidationResult> {
  const trimmed = spec.trim();
  if (!trimmed) {
    throw new Error("Engine ABI validation requires a non-empty module spec");
  }

  const timeoutMs = options.timeoutMs ?? defaultEngineStartupTimeoutMs();
  return withTimeout(
    validateEngineAbiInner(trimmed),
    timeoutMs,
    "abi_validation",
  );
}
