import { Queue } from "bullmq";
import { SCAN_QUEUE_NAME, type ScanQueueJob } from "@mergesignal/shared";

const connection = {
  url: process.env.REDIS_URL!,
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
};

/** @deprecated Use ScanQueueJob from @mergesignal/shared */
export type ScanJob = ScanQueueJob;

export { SCAN_QUEUE_NAME };

let _scanQueue: Queue<ScanQueueJob> | null = null;

export const scanQueue = new Proxy({} as Queue<ScanQueueJob>, {
  get(target, prop) {
    if (!_scanQueue) {
      _scanQueue = new Queue<ScanJob>(SCAN_QUEUE_NAME, { connection });
    }
    return Reflect.get(_scanQueue, prop);
  },
});
