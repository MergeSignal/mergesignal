import type {
  CodeAnalysisInput,
  ScanRequest,
  ScanResult,
  ScanQueueJob,
  UpgradeSimulationRequest,
  UpgradeSimulationResult,
} from "@mergesignal/shared";
import { scanSurfaceCopy } from "@mergesignal/shared";

import { productionScanIngressModuleSpec } from "./engineRuntimePaths.js";
import type {
  AnalyzeWithProductionOptionsFn,
  OrchestrateProductionScanIngressFn,
  ProductionAnalyzeOptions,
  ProductionScanIngressResult,
  OrchestrateProductionScanIngressOptions,
} from "./productionAnalyzeOptions.js";

export type { ProductionAnalyzeOptions, ProductionScanIngressResult };
export type { OrchestrateProductionScanIngressOptions };

export type EngineImpl = {
  analyze: AnalyzeWithProductionOptionsFn;
  simulateUpgrade: (
    req: UpgradeSimulationRequest,
  ) => Promise<UpgradeSimulationResult>;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function engineStrict(): boolean {
  return process.env.MERGESIGNAL_ENGINE_STRICT === "1";
}

/** CI / CLI paths that must load a real engine (no silent stub). */
function trustedAnalysis(): boolean {
  return process.env.MERGESIGNAL_TRUSTED_ANALYSIS === "1";
}

/** Production or explicit trusted scan — stub only when MERGESIGNAL_ALLOW_STUB=1. */
export function requiresStrictEngineScanValidation(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.MERGESIGNAL_ALLOW_STUB === "1") return false;
  return (
    env.NODE_ENV === "production" || env.MERGESIGNAL_TRUSTED_ANALYSIS === "1"
  );
}

function mustLoadRealEngine(): boolean {
  return requiresStrictEngineScanValidation();
}

export function implSpec(): string {
  return String(process.env.MERGESIGNAL_ENGINE_IMPL ?? "").trim();
}

async function loadFromSpec(spec: string): Promise<EngineImpl> {
  const mod = (await import(spec)) as Record<string, unknown>;
  const analyzeFn = mod.analyze;
  const simulateUpgradeFn = mod.simulateUpgrade;
  if (
    typeof analyzeFn !== "function" ||
    typeof simulateUpgradeFn !== "function"
  ) {
    throw new Error(
      `Engine module ${spec} does not export analyze and simulateUpgrade functions`,
    );
  }
  return {
    analyze: analyzeFn as AnalyzeWithProductionOptionsFn,
    simulateUpgrade: simulateUpgradeFn as EngineImpl["simulateUpgrade"],
  };
}

async function loadStub(): Promise<EngineImpl> {
  const stub = await import("@mergesignal/engine-stub");
  return {
    analyze: stub.analyze as AnalyzeWithProductionOptionsFn,
    simulateUpgrade: stub.simulateUpgrade,
  };
}

async function loadImpl(): Promise<EngineImpl> {
  const spec = implSpec();
  const strict = engineStrict();
  const realRequired = mustLoadRealEngine();

  if (realRequired) {
    if (!spec) {
      const trusted = trustedAnalysis();
      throw new Error(
        trusted && !isProduction()
          ? scanSurfaceCopy.engineLoader.implRequiredTrustedScan
          : scanSurfaceCopy.engineLoader.implRequiredProduction,
      );
    }
    return loadFromSpec(spec);
  }

  if (spec) {
    try {
      return await loadFromSpec(spec);
    } catch (e) {
      if (strict) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      const specForLog =
        spec.length > 120 || /^(https?:)?\/\//i.test(spec)
          ? `${spec.slice(0, 80)}…`
          : spec;
      console.warn(
        `[mergesignal-engine] Failed to load configured analysis engine (${specForLog}): ${msg}. Falling back to stub.`,
      );
      return loadStub();
    }
  }

  return loadStub();
}

let cached: Promise<EngineImpl> | null = null;
let cachedIngress: Promise<OrchestrateProductionScanIngressFn> | null = null;

export async function getImpl(): Promise<EngineImpl> {
  cached ??= loadImpl();
  return cached;
}

async function loadProductionScanIngress(): Promise<OrchestrateProductionScanIngressFn> {
  const ingressSpec = await productionScanIngressModuleSpec();
  const mod = (await import(ingressSpec)) as Record<string, unknown>;
  const fn = mod.orchestrateProductionScanIngress;
  if (typeof fn !== "function") {
    throw new Error(
      `Production scan ingress module ${ingressSpec} does not export orchestrateProductionScanIngress`,
    );
  }
  return fn as OrchestrateProductionScanIngressFn;
}

export async function getProductionScanIngress(): Promise<OrchestrateProductionScanIngressFn> {
  cachedIngress ??= loadProductionScanIngress();
  return cachedIngress;
}

/** Test-only: reset dynamic loader state between Vitest cases. */
export function __resetEngineLoaderCacheForTests(): void {
  cached = null;
  cachedIngress = null;
}

export async function orchestrateProductionScanIngress(
  job: ScanQueueJob,
  options?: OrchestrateProductionScanIngressOptions,
): Promise<ProductionScanIngressResult> {
  const ingress = await getProductionScanIngress();
  return ingress(job, options);
}

export async function analyze(
  req: ScanRequest,
  codeAnalysis?: CodeAnalysisInput,
  options?: ProductionAnalyzeOptions,
): Promise<ScanResult> {
  const impl = await getImpl();
  return (await impl.analyze(req, codeAnalysis, options)) as ScanResult;
}

export async function simulateUpgrade(
  req: UpgradeSimulationRequest,
): Promise<UpgradeSimulationResult> {
  const impl = await getImpl();
  return impl.simulateUpgrade(req);
}
