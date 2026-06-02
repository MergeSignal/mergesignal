export {
  detectChangedPackages,
  detectLockfilePackageDelta,
} from "./lockfile-diff.js";
export { getInstallationToken, clearTokenCache } from "./github-auth.js";
export {
  fetchGitHubFiles,
  classifyFetchError,
  type FetchOptions,
  type FetchResult,
} from "./github-files.js";
export {
  getCachedFiles,
  setCachedFiles,
  clearCache,
  cleanupExpiredEntries,
  __resetFileCacheForTests,
} from "./file-cache.js";
export {
  prepareScanContext,
  type PrepareScanContextResult,
  type ScanPreparationSummary,
} from "./prepareScanContext.js";
