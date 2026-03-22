import { Queue } from "bullmq";
import type { ScanLockfileInput, RepoSource } from "@mergesignal/shared";

const connection = {
  url: process.env.REDIS_URL!,
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
};

export type ScanJob = {
  scanId: string;
  repoId: string;
  dependencyGraph: unknown;
  lockfile?: ScanLockfileInput;
  baseLockfile?: ScanLockfileInput;
  repoSource?: RepoSource;
  github?: {
    owner: string;
    repo: string;
    prNumber: number;
    headSha: string;
    baseSha?: string;
    installationId: number;
    deliveryId?: string;
  };
};

export const SCAN_QUEUE_NAME = "scan-queue";

let _scanQueue: Queue<ScanJob> | null = null;

export const scanQueue = new Proxy({} as Queue<ScanJob>, {
  get(target, prop) {
    if (!_scanQueue) {
      _scanQueue = new Queue<ScanJob>(SCAN_QUEUE_NAME, { connection });
    }
    return Reflect.get(_scanQueue, prop);
  },
});