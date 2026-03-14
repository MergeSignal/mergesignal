import type { ScanRequest, ScanResult, UpgradeSimulationRequest, UpgradeSimulationResult } from "@reposentinel/shared";

type EngineImpl = {
  analyze: (req: ScanRequest) => Promise<ScanResult>;
  simulateUpgrade: (req: UpgradeSimulationRequest) => Promise<UpgradeSimulationResult>;
};

let cached: Promise<EngineImpl> | null = null;

async function loadImpl(): Promise<EngineImpl> {
  const spec = String(process.env.REPOSENTINEL_ENGINE_IMPL ?? "").trim();
  const strict = (process.env.REPOSENTINEL_ENGINE_STRICT ?? "0") === "1";

  if (spec) {
    try {
      const mod = (await import(spec)) as any;
      if (typeof mod?.analyze !== "function" || typeof mod?.simulateUpgrade !== "function") {
        throw new Error(`Engine module ${spec} does not export analyze/simulateUpgrade`);
      }
      return { analyze: mod.analyze, simulateUpgrade: mod.simulateUpgrade };
    } catch (e) {
      if (strict) throw e;
      // Fall back to stub if a proprietary engine is not installed.
    }
  }

  const stub = (await import("@reposentinel/engine-stub")) as any;
  return { analyze: stub.analyze, simulateUpgrade: stub.simulateUpgrade };
}

async function getImpl() {
  cached ??= loadImpl();
  return cached;
}

export async function analyze(req: ScanRequest): Promise<ScanResult> {
  const impl = await getImpl();
  return impl.analyze(req);
}

export async function simulateUpgrade(req: UpgradeSimulationRequest): Promise<UpgradeSimulationResult> {
  const impl = await getImpl();
  return impl.simulateUpgrade(req);
}

