import { randomUUID } from "node:crypto";
import {
  ACQUISITION_POLL_MS,
  FULFILLMENT_TIMEOUT_MS,
  MAX_OBJECT_BYTES,
  SESSION_DEADLINE_MS,
} from "./limits.js";

type AcquisitionPhase = "open" | "pending" | "fulfilled" | "closed";

type AcquisitionSlot = {
  generation: string;
  deadlineAt: number;
  phase: AcquisitionPhase;
  objectId?: string;
  body?: string;
  failure?: "oversized";
};

export type AcquisitionTransaction = {
  set(
    key: string,
    value: string,
    mode: "PX",
    ttlMs: number,
  ): AcquisitionTransaction;
  del(key: string): AcquisitionTransaction;
  exec(): Promise<unknown>;
};

export type AcquisitionRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  watch(key: string): Promise<unknown>;
  unwatch(): Promise<unknown>;
  multi(): AcquisitionTransaction;
};

export type LocalAcquisitionSession = {
  scanId: string;
  generation: string;
  deadlineAt: number;
  closed: boolean;
};

export type PendingAcquisition = {
  objectId: string;
  generation: string;
};

export type RawObjectResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "closed" | "timeout" | "oversized" | "rejected" };

type Clock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

const defaultClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function slotKey(scanId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(scanId)) {
    throw new Error("invalid scan id");
  }
  return `ms:local-acq:${scanId}`;
}

function parseSlot(raw: string | null): AcquisitionSlot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as AcquisitionSlot;
    if (!value || typeof value.generation !== "string") return null;
    if (
      value.phase !== "open" &&
      value.phase !== "pending" &&
      value.phase !== "fulfilled" &&
      value.phase !== "closed"
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function ttlFor(slot: AcquisitionSlot, now: number): number {
  return Math.max(1, slot.deadlineAt - now);
}

async function commit(
  redis: AcquisitionRedis,
  scanId: string,
  now: number,
  update: (current: AcquisitionSlot | null) => {
    slot: AcquisitionSlot | null;
    unchanged?: boolean;
  },
): Promise<AcquisitionSlot | null> {
  const key = slotKey(scanId);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await redis.watch(key);
    const current = parseSlot(await redis.get(key));
    const next = update(current);
    if (next.unchanged) {
      await redis.unwatch();
      return current;
    }
    const tx = redis.multi();
    if (next.slot === null) tx.del(key);
    else tx.set(key, JSON.stringify(next.slot), "PX", ttlFor(next.slot, now));
    const executed = await tx.exec();
    if (executed !== null) return next.slot;
  }
  throw new Error("acquisition session conflict");
}

export async function openLocalAcquisition(
  redis: AcquisitionRedis,
  scanId: string,
  now = Date.now(),
): Promise<LocalAcquisitionSession> {
  const slot: AcquisitionSlot = {
    generation: randomUUID(),
    deadlineAt: now + SESSION_DEADLINE_MS,
    phase: "open",
  };
  await redis.set(
    slotKey(scanId),
    JSON.stringify(slot),
    "PX",
    SESSION_DEADLINE_MS,
  );
  return {
    scanId,
    generation: slot.generation,
    deadlineAt: slot.deadlineAt,
    closed: false,
  };
}

function closeUpdate(slot: AcquisitionSlot | null): {
  slot: AcquisitionSlot | null;
} {
  if (!slot) return { slot: null };
  return {
    slot: {
      generation: slot.generation,
      deadlineAt: slot.deadlineAt,
      phase: "closed",
    },
  };
}

export async function closeLocalAcquisition(
  redis: AcquisitionRedis,
  scanId: string,
): Promise<void> {
  await redis.del(slotKey(scanId));
}

export async function readPendingAcquisition(
  redis: AcquisitionRedis,
  scanId: string,
  now = Date.now(),
): Promise<PendingAcquisition | null> {
  const slot = parseSlot(await redis.get(slotKey(scanId)));
  if (!slot || slot.phase !== "pending" || !slot.objectId) return null;
  if (now >= slot.deadlineAt) return null;
  return { objectId: slot.objectId, generation: slot.generation };
}

export async function fulfillAcquisition(
  redis: AcquisitionRedis,
  input: {
    scanId: string;
    generation: string;
    objectId: string;
    bytes: Uint8Array;
    now?: number;
  },
): Promise<"accepted" | "rejected" | "oversized"> {
  const now = input.now ?? Date.now();
  let outcome: "accepted" | "rejected" | "oversized" = "rejected";
  await commit(redis, input.scanId, now, (current) => {
    if (
      !current ||
      current.generation !== input.generation ||
      current.phase !== "pending" ||
      current.objectId !== input.objectId.toLowerCase()
    ) {
      outcome = "rejected";
      return { slot: current, unchanged: true };
    }
    if (now >= current.deadlineAt) {
      outcome = "rejected";
      return closeUpdate(current);
    }
    if (input.bytes.byteLength > MAX_OBJECT_BYTES) {
      outcome = "oversized";
      return {
        slot: {
          generation: current.generation,
          deadlineAt: current.deadlineAt,
          phase: "fulfilled",
          objectId: current.objectId,
          failure: "oversized",
        },
      };
    }
    outcome = "accepted";
    return {
      slot: {
        generation: current.generation,
        deadlineAt: current.deadlineAt,
        phase: "fulfilled",
        objectId: current.objectId,
        body: Buffer.from(input.bytes).toString("base64"),
      },
    };
  });
  return outcome;
}

export async function requestRawObject(
  redis: AcquisitionRedis,
  session: LocalAcquisitionSession,
  objectId: string,
  clock: Clock = defaultClock,
): Promise<RawObjectResult> {
  const normalized = objectId.toLowerCase();
  if (session.closed || clock.now() >= session.deadlineAt) {
    session.closed = true;
    return { ok: false, reason: "closed" };
  }

  const opened: { result: "pending" | "closed" } = { result: "closed" };
  await commit(redis, session.scanId, clock.now(), (current) => {
    if (!current || current.generation !== session.generation) {
      opened.result = "closed";
      return { slot: current, unchanged: true };
    }
    if (current.phase === "closed" || clock.now() >= current.deadlineAt) {
      opened.result = "closed";
      return closeUpdate(current);
    }
    if (current.phase !== "open") {
      opened.result = "closed";
      return { slot: current, unchanged: true };
    }
    opened.result = "pending";
    return {
      slot: {
        generation: current.generation,
        deadlineAt: current.deadlineAt,
        phase: "pending",
        objectId: normalized,
      },
    };
  });
  if (opened.result !== "pending") {
    session.closed = true;
    return { ok: false, reason: "closed" };
  }

  const waitUntil = Math.min(
    clock.now() + FULFILLMENT_TIMEOUT_MS,
    session.deadlineAt,
  );
  while (clock.now() < waitUntil) {
    const taken = await takeFulfilled(redis, session, normalized, clock.now());
    if (taken) {
      if (!taken.ok && taken.reason !== "oversized") session.closed = true;
      return taken;
    }
    const remaining = waitUntil - clock.now();
    if (remaining <= 0) break;
    await clock.sleep(Math.min(ACQUISITION_POLL_MS, remaining));
  }

  session.closed = true;
  await commit(redis, session.scanId, clock.now(), (current) => {
    if (!current || current.generation !== session.generation) {
      return { slot: current, unchanged: true };
    }
    return closeUpdate(current);
  });
  return { ok: false, reason: "timeout" };
}

async function takeFulfilled(
  redis: AcquisitionRedis,
  session: LocalAcquisitionSession,
  objectId: string,
  now: number,
): Promise<RawObjectResult | null> {
  let result: RawObjectResult | null = null;
  await commit(redis, session.scanId, now, (current) => {
    if (!current || current.generation !== session.generation) {
      result = { ok: false, reason: "closed" };
      return { slot: current, unchanged: true };
    }
    if (now >= current.deadlineAt && current.phase !== "fulfilled") {
      result = { ok: false, reason: "timeout" };
      return closeUpdate(current);
    }
    if (current.phase === "fulfilled" && current.objectId === objectId) {
      if (current.failure === "oversized") {
        result = { ok: false, reason: "oversized" };
      } else if (current.body) {
        result = {
          ok: true,
          bytes: new Uint8Array(Buffer.from(current.body, "base64")),
        };
      } else {
        result = { ok: false, reason: "rejected" };
      }
      return {
        slot: {
          generation: current.generation,
          deadlineAt: current.deadlineAt,
          phase: "open",
        },
      };
    }
    if (current.phase === "closed") {
      result = { ok: false, reason: "closed" };
      return { slot: current, unchanged: true };
    }
    result = null;
    return { slot: current, unchanged: true };
  });
  return result;
}
