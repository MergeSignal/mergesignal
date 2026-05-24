import {
  EngineAbiTimeoutError,
  initializeEngine,
  type EngineLoadInfo,
} from "@mergesignal/engine";
import { captureWorkerException } from "./sentry.js";

function logEvent(
  level: "info" | "warn" | "error",
  msg: string,
  fields: Record<string, unknown>,
): void {
  const line = JSON.stringify({ msg, ...fields });
  if (level === "info") console.info(line);
  else if (level === "warn") console.warn(line);
  else console.error(line);
}

export async function runEngineStartup(): Promise<EngineLoadInfo> {
  logEvent("info", "engine_load_start", {
    production: process.env.NODE_ENV === "production",
    implSpec: process.env.MERGESIGNAL_ENGINE_IMPL ?? "",
  });

  try {
    const info = await initializeEngine();

    logEvent("info", "engine_abi_validation_done", {
      durationMs: info.abiValidationDurationMs,
      methodologyVersion: info.methodologyVersion,
      engineReleaseVersion: info.releaseVersion,
      engineReleaseGitSha: info.releaseGitSha,
    });

    logEvent("info", "engine_load_success", {
      spec: info.spec,
      stub: info.stub,
      durationMs: info.loadDurationMs,
      abiValidationDurationMs: info.abiValidationDurationMs,
      engineReleaseVersion: info.releaseVersion,
      engineReleaseRef: info.releaseRef,
      engineReleaseGitSha: info.releaseGitSha,
      methodologyVersion: info.methodologyVersion,
    });

    return info;
  } catch (e: unknown) {
    if (e instanceof EngineAbiTimeoutError) {
      logEvent("error", "engine_startup_timeout", {
        timeoutMs: e.timeoutMs,
        phase: e.phase,
        err: e.message,
      });
    } else {
      logEvent("error", "engine_load_failed", {
        err: e instanceof Error ? e.message : String(e),
      });
    }
    captureWorkerException(e);
    throw e;
  }
}

export function logWorkerStartupComplete(
  engineInfo: EngineLoadInfo,
  bootDurationMs: number,
  workerId: string,
): void {
  logEvent("info", "worker_startup_complete", {
    workerId,
    bootDurationMs,
    abiValidationDurationMs: engineInfo.abiValidationDurationMs,
    engineLoadDurationMs: engineInfo.loadDurationMs,
    engineReleaseVersion: engineInfo.releaseVersion,
    engineReleaseRef: engineInfo.releaseRef,
    engineReleaseGitSha: engineInfo.releaseGitSha,
    engineImplPath: engineInfo.spec,
    methodologyVersion: engineInfo.methodologyVersion,
    nodeVersion: process.version,
  });
}
