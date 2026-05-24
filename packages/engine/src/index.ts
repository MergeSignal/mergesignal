export type { EngineImpl } from "./loader.js";
export {
  analyze,
  simulateUpgrade,
  getImpl,
  implSpec,
  requiresStrictEngineScanValidation,
  __resetEngineLoaderCacheForTests,
} from "./loader.js";

export type { EngineLoadInfo } from "./engineStartup.js";
export {
  initializeEngine,
  getEngineLoadInfo,
  __resetEngineStartupCacheForTests,
} from "./engineStartup.js";

export {
  EngineAbiTimeoutError,
  withTimeout,
  defaultEngineStartupTimeoutMs,
} from "./withTimeout.js";

export type {
  EngineAbiValidationResult,
  ValidateEngineAbiOptions,
} from "./validateEngineAbi.js";
export {
  validateEngineAbi,
  ABI_PROBE_SCAN_REQUEST,
  ABI_PROBE_UPGRADE_REQUEST,
} from "./validateEngineAbi.js";
