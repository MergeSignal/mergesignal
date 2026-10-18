import { Redis } from "ioredis";
import { type AcquisitionRedis } from "@mergesignal/engine";

let client: Redis | null = null;
let testRedis: AcquisitionRedis | null = null;

export function __setAcquisitionRedisForTests(
  redis: AcquisitionRedis | null,
): void {
  testRedis = redis;
}

export function getAcquisitionRedis(): AcquisitionRedis | null {
  if (testRedis) return testRedis;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) {
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return client;
}
