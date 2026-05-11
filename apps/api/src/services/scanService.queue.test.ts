import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createScanAndEnqueue } from "./scanService.js";

const add = vi.fn().mockResolvedValue(undefined);

vi.mock("../queue.js", () => ({
  scanQueue: { add: (...args: unknown[]) => add(...args) },
}));

vi.mock("../db.js", () => {
  const client = {
    query: vi.fn(),
    release: vi.fn(),
  };
  client.query.mockImplementation(async (sql: string) => {
    if (sql === "BEGIN") return {};
    if (sql === "COMMIT") return {};
    if (sql === "ROLLBACK") return {};
    if (sql.startsWith("SELECT id, status FROM scans")) {
      return { rowCount: 0, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  });
  return {
    db: {
      connect: vi.fn(async () => client),
      query: vi.fn(async () => ({ rows: [{ c: 0 }], rowCount: 1 })),
    },
    queries: {
      scans: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
});

vi.mock("./tier.js", () => ({
  getLimitsForOwner: () => ({
    scanMaxLockfileBytes: 1_000_000,
    scansPerOwnerPerDay: -1,
    githubScansPerOwnerPerDay: -1,
  }),
  getOwnerFromRepoId: (id: string) => id.split("/")[0] ?? id,
}));

describe("createScanAndEnqueue queue options", () => {
  beforeEach(() => {
    add.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues scan jobs with a single BullMQ attempt (no failed→done overwrite)", async () => {
    await createScanAndEnqueue({
      repoId: "acme/app",
      dependencyGraph: {},
      source: "manual",
    });
    expect(add).toHaveBeenCalledTimes(1);
    const opts = add.mock.calls[0]![2] as { attempts?: number };
    expect(opts.attempts).toBe(1);
  });
});
