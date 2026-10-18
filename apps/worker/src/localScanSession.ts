import { Redis } from "ioredis";
import {
  closeLocalAcquisition,
  createLocalRepositoryReader,
  openLocalAcquisition,
  requestRawObject,
  type ProductionRepositoryReader,
} from "@mergesignal/engine";

export async function openWorkerLocalReader(scanId: string): Promise<{
  reader: ProductionRepositoryReader;
  close: () => Promise<void>;
}> {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required");
  const redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  await redis.connect();
  const session = await openLocalAcquisition(redis, scanId);
  return {
    reader: createLocalRepositoryReader({
      request: (objectId) => requestRawObject(redis, session, objectId),
    }),
    close: async () => {
      session.closed = true;
      await closeLocalAcquisition(redis, scanId);
      await redis.quit();
    },
  };
}
