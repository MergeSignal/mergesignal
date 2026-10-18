import { describe, expect, it } from "vitest";
import { hashGitObject } from "./gitObject.js";
import { FULFILLMENT_TIMEOUT_MS } from "./limits.js";
import { createLocalRepositoryReader } from "./reader.js";
import {
  closeLocalAcquisition,
  fulfillAcquisition,
  openLocalAcquisition,
  requestRawObject,
  type AcquisitionRedis,
  type AcquisitionTransaction,
} from "./session.js";

class FakeRedis implements AcquisitionRedis {
  values = new Map<string, string>();
  private watching = false;
  private seen = new Map<string, string | null>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(
    key: string,
    value: string,
    _mode: "PX",
    _ttlMs: number,
  ): Promise<unknown> {
    this.values.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<unknown> {
    this.values.delete(key);
    return 1;
  }

  async watch(key: string): Promise<unknown> {
    this.watching = true;
    this.seen.set(key, this.values.get(key) ?? null);
    return "OK";
  }

  async unwatch(): Promise<unknown> {
    this.watching = false;
    this.seen.clear();
    return "OK";
  }

  multi(): AcquisitionTransaction {
    const ops: Array<() => void> = [];
    const snapshot = new Map(this.seen);
    const tx: AcquisitionTransaction = {
      set: (key, value) => {
        ops.push(() => this.values.set(key, value));
        return tx;
      },
      del: (key) => {
        ops.push(() => this.values.delete(key));
        return tx;
      },
      exec: async () => {
        if (this.watching) {
          for (const [key, previous] of snapshot) {
            if ((this.values.get(key) ?? null) !== previous) {
              this.watching = false;
              this.seen.clear();
              return null;
            }
          }
        }
        for (const op of ops) op();
        this.watching = false;
        this.seen.clear();
        return [];
      },
    };
    return tx;
  }
}

describe("local acquisition session", () => {
  it("accepts one matching object and rejects duplicates, stale generations, and late writes", async () => {
    const redis = new FakeRedis();
    let now = 1_000;
    const sleeps: number[] = [];
    const clock = {
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        now += ms;
      },
    };
    const session = await openLocalAcquisition(redis, "scan-1", now);
    const objectId = "a".repeat(40);
    let delivered = false;
    clock.sleep = async (ms: number) => {
      sleeps.push(ms);
      if (!delivered) {
        delivered = true;
        expect(
          await fulfillAcquisition(redis, {
            scanId: "scan-1",
            generation: session.generation,
            objectId,
            bytes: Buffer.from("blob"),
            now,
          }),
        ).toBe("accepted");
        expect(
          await fulfillAcquisition(redis, {
            scanId: "scan-1",
            generation: session.generation,
            objectId,
            bytes: Buffer.from("again"),
            now,
          }),
        ).toBe("rejected");
      }
      now += ms;
    };
    await expect(
      requestRawObject(redis, session, objectId, clock),
    ).resolves.toEqual({
      ok: true,
      bytes: new Uint8Array(Buffer.from("blob")),
    });

    const recovered = await openLocalAcquisition(redis, "scan-1", now);
    expect(recovered.generation).not.toBe(session.generation);
    expect(
      await fulfillAcquisition(redis, {
        scanId: "scan-1",
        generation: session.generation,
        objectId,
        bytes: Buffer.from("stale"),
        now,
      }),
    ).toBe("rejected");
    expect(
      await fulfillAcquisition(redis, {
        scanId: "scan-1",
        generation: recovered.generation,
        objectId: "b".repeat(40),
        bytes: Buffer.from("wrong-id"),
        now,
      }),
    ).toBe("rejected");

    await closeLocalAcquisition(redis, "scan-1");
    expect(
      await fulfillAcquisition(redis, {
        scanId: "scan-1",
        generation: recovered.generation,
        objectId,
        bytes: Buffer.from("late"),
        now,
      }),
    ).toBe("rejected");
    expect(sleeps.length).toBeGreaterThan(0);
  });

  it("closes acquisition after the first missed fulfillment", async () => {
    const redis = new FakeRedis();
    let now = 5_000;
    let slept = 0;
    const clock = {
      now: () => now,
      sleep: async (ms: number) => {
        slept += 1;
        now += ms;
      },
    };
    const session = await openLocalAcquisition(redis, "scan-2", now);
    const first = await requestRawObject(redis, session, "c".repeat(40), clock);
    expect(first).toEqual({ ok: false, reason: "timeout" });
    const sleepsAfterClose = slept;
    const second = await requestRawObject(
      redis,
      session,
      "d".repeat(40),
      clock,
    );
    expect(second).toEqual({ ok: false, reason: "closed" });
    expect(slept).toBe(sleepsAfterClose);
    expect(now - 5_000).toBeLessThan(FULFILLMENT_TIMEOUT_MS + 1_000);
  });

  it("does not open a new wait after the session deadline", async () => {
    const redis = new FakeRedis();
    const openedAt = 10;
    const session = await openLocalAcquisition(redis, "scan-3", openedAt);
    let slept = 0;
    const clock = {
      now: () => session.deadlineAt,
      sleep: async () => {
        slept += 1;
      },
    };
    const result = await requestRawObject(
      redis,
      session,
      "e".repeat(40),
      clock,
    );
    expect(result).toEqual({ ok: false, reason: "closed" });
    expect(slept).toBe(0);
  });

  it("returns a blob only after the session delivers matching raw bytes", async () => {
    const redis = new FakeRedis();
    let now = 1_000;
    const session = await openLocalAcquisition(redis, "scan-rt", now);
    const bytes = Buffer.from("export const value = 1;\n");
    const objectId = hashGitObject("blob", bytes, "sha1");
    const clock = {
      now: () => now,
      sleep: async (ms: number) => {
        await fulfillAcquisition(redis, {
          scanId: "scan-rt",
          generation: session.generation,
          objectId,
          bytes,
          now,
        });
        now += ms;
      },
    };
    const reader = createLocalRepositoryReader({
      request: (id) => requestRawObject(redis, session, id, clock),
    });
    const blob = await reader.readBlob(objectId);
    expect(Buffer.from(blob.bytes).toString("utf8")).toBe(
      bytes.toString("utf8"),
    );
    await closeLocalAcquisition(redis, "scan-rt");
    expect(redis.values.has("ms:local-acq:scan-rt")).toBe(false);
  });

  it("serves overlapping blob reads one pending object at a time", async () => {
    const redis = new FakeRedis();
    let now = 1_000;
    const session = await openLocalAcquisition(redis, "scan-overlap", now);
    const firstBytes = Buffer.from("one");
    const secondBytes = Buffer.from("two");
    const firstId = hashGitObject("blob", firstBytes, "sha1");
    const secondId = hashGitObject("blob", secondBytes, "sha1");
    const bodies = new Map<string, Buffer>([
      [firstId, firstBytes],
      [secondId, secondBytes],
    ]);
    const pendingOrder: string[] = [];
    const clock = {
      now: () => now,
      sleep: async (ms: number) => {
        const raw = redis.values.get("ms:local-acq:scan-overlap");
        const slot = JSON.parse(raw ?? "null") as {
          phase?: string;
          objectId?: string;
        };
        expect(slot.phase).toBe("pending");
        expect(slot.objectId).toBeTruthy();
        expect(pendingOrder.at(-1)).not.toBe(slot.objectId);
        pendingOrder.push(slot.objectId!);
        const bytes = bodies.get(slot.objectId!);
        expect(bytes).toBeDefined();
        expect(
          await fulfillAcquisition(redis, {
            scanId: "scan-overlap",
            generation: session.generation,
            objectId: slot.objectId!,
            bytes: bytes!,
            now,
          }),
        ).toBe("accepted");
        now += ms;
      },
    };
    const reader = createLocalRepositoryReader({
      request: (id) => requestRawObject(redis, session, id, clock),
    });
    const [first, second] = await Promise.all([
      reader.readBlob(firstId),
      reader.readBlob(secondId),
    ]);
    expect(Buffer.from(first.bytes).toString("utf8")).toBe("one");
    expect(Buffer.from(second.bytes).toString("utf8")).toBe("two");
    expect(pendingOrder).toEqual([firstId, secondId]);
    expect(session.closed).toBe(false);
    const slot = JSON.parse(
      redis.values.get("ms:local-acq:scan-overlap") ?? "null",
    ) as { phase?: string };
    expect(slot.phase).toBe("open");
  });
});
