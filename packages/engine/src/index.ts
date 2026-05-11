import type {
  ScanRequest,
  ScanResult,
  UpgradeSimulationRequest,
  UpgradeSimulationResult,
} from "@mergesignal/shared";

export type EngineImpl = {
  analyze: (req: ScanRequest) => Promise<ScanResult>;
  simulateUpgrade: (
    req: UpgradeSimulationRequest,
  ) => Promise<UpgradeSimulationResult>;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function allowStub(): boolean {
  return process.env.MERGESIGNAL_ALLOW_STUB === "1";
}

function engineStrict(): boolean {
  return process.env.MERGESIGNAL_ENGINE_STRICT === "1";
}

function implSpec(): string {
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
    analyze: analyzeFn as EngineImpl["analyze"],
    simulateUpgrade: simulateUpgradeFn as EngineImpl["simulateUpgrade"],
  };
}

async function loadStub(): Promise<EngineImpl> {
  const stub = await import("@mergesignal/engine-stub");
  return {
    analyze: stub.analyze,
    simulateUpgrade: stub.simulateUpgrade,
  };
}

async function loadImpl(): Promise<EngineImpl> {
  const spec = implSpec();
  const strict = engineStrict();

  if (isProduction() && !allowStub()) {
    if (!spec) {
      throw new Error(
        "MERGESIGNAL_ENGINE_IMPL is required in production (set MERGESIGNAL_ALLOW_STUB=1 only for demo stacks)",
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
      console.warn(
        `[mergesignal-engine] Failed to load MERGESIGNAL_ENGINE_IMPL=${spec}: ${msg}. Falling back to stub.`,
      );
      return loadStub();
    }
  }

  return loadStub();
}

let cached: Promise<EngineImpl> | null = null;

async function getImpl(): Promise<EngineImpl> {
  cached ??= loadImpl();
  return cached;
}

/** Test-only: reset dynamic loader state between Vitest cases. */
export function __resetEngineLoaderCacheForTests(): void {
  cached = null;
}

export async function analyze(req: ScanRequest): Promise<ScanResult> {
  const impl = await getImpl();
  return impl.analyze(req);
}

export async function simulateUpgrade(
  req: UpgradeSimulationRequest,
): Promise<UpgradeSimulationResult> {
  const impl = await getImpl();
  return impl.simulateUpgrade(req);
}
