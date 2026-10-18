export type { EngineImpl } from "./loader.js";
export type {
  ProductionAnalyzeOptions,
  ProductionScanIngressResult,
  OrchestrateProductionScanIngressOptions,
  ProductionRepositoryReader,
} from "./loader.js";
export { MAX_OBJECT_BYTES } from "./localAcquisition/limits.js";
export {
  closeLocalAcquisition,
  fulfillAcquisition,
  openLocalAcquisition,
  readPendingAcquisition,
  requestRawObject,
} from "./localAcquisition/session.js";
export type {
  AcquisitionRedis,
  AcquisitionTransaction,
  LocalAcquisitionSession,
  PendingAcquisition,
  RawObjectResult,
} from "./localAcquisition/session.js";
export { createLocalRepositoryReader } from "./localAcquisition/reader.js";
export {
  hashAlgorithmForObjectId,
  hashGitObject,
  parseCommitTreeId,
  parseGitTree,
  verifyGitObject,
} from "./localAcquisition/gitObject.js";
export {
  analyze,
  simulateUpgrade,
  orchestrateProductionScanIngress,
  getProductionScanIngress,
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
