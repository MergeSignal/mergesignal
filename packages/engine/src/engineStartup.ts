import { defaultEngineStartupTimeoutMs } from "./withTimeout.js";
import { validateEngineAbi } from "./validateEngineAbi.js";
import {
  getImpl,
  implSpec,
  requiresStrictEngineScanValidation,
} from "./loader.js";

export type EngineLoadInfo = {
  spec: string;
  stub: boolean;
  releaseVersion?: string;
  releaseRef?: string;
  releaseGitSha?: string;
  methodologyVersion: string;
  loadedAt: string;
  loadDurationMs: number;
  abiValidationDurationMs: number;
};

let cachedLoadInfo: EngineLoadInfo | null = null;

export function getEngineLoadInfo(): EngineLoadInfo | null {
  return cachedLoadInfo;
}

/** Test-only: reset startup cache between Vitest cases. */
export function __resetEngineStartupCacheForTests(): void {
  cachedLoadInfo = null;
}

function readManifestField(
  manifest: Record<string, unknown> | null,
  key: string,
): string | undefined {
  const v = manifest?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function readEngineManifest(): Promise<Record<string, unknown> | null> {
  const path = String(process.env.MERGESIGNAL_ENGINE_MANIFEST ?? "").trim();
  if (!path) return null;
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Manifest is optional outside production worker images.
  }
  return null;
}

/**
 * One-time engine startup preflight: ABI validation + impl load.
 * Cached for process lifetime. Never call from scan/job paths.
 */
export async function initializeEngine(): Promise<EngineLoadInfo> {
  if (cachedLoadInfo) return cachedLoadInfo;

  const started = Date.now();
  const spec = implSpec();

  if (requiresStrictEngineScanValidation() && !spec) {
    throw new Error(
      "Engine startup requires MERGESIGNAL_ENGINE_IMPL in this environment",
    );
  }

  const manifest = await readEngineManifest();
  const releaseVersion =
    readManifestField(manifest, "engineReleaseVersion") ??
    readManifestField(manifest, "packageVersion");
  const releaseRef =
    readManifestField(manifest, "ref") ??
    readManifestField(manifest, "engineReleaseVersion");
  const releaseGitSha = readManifestField(manifest, "engineReleaseGitSha");

  let abiResult: Awaited<ReturnType<typeof validateEngineAbi>> | undefined;
  let abiValidationDurationMs = 0;

  if (spec) {
    const abiStarted = Date.now();
    abiResult = await validateEngineAbi(spec, {
      timeoutMs: defaultEngineStartupTimeoutMs(),
    });
    abiValidationDurationMs = Date.now() - abiStarted;
  }

  await getImpl();

  const info: EngineLoadInfo = {
    spec: spec || "@mergesignal/engine-stub",
    stub: !spec,
    releaseVersion,
    releaseRef,
    releaseGitSha,
    methodologyVersion:
      abiResult?.methodologyVersion ?? (spec ? "unknown" : "engine-stub/v2"),
    loadedAt: new Date().toISOString(),
    loadDurationMs: Date.now() - started,
    abiValidationDurationMs,
  };

  cachedLoadInfo = info;
  return info;
}
