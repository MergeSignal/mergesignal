import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createScanAndEnqueue } from "./scanService.js";
import { getLimitsForOwner } from "./tier.js";

const add = vi.fn().mockResolvedValue(undefined);
const { transaction } = vi.hoisted(() => {
  const transaction = {
    query: vi.fn(),
    release: vi.fn(),
  };
  return { transaction };
});

vi.mock("../queue.js", () => ({
  scanQueue: { add: (...args: unknown[]) => add(...args) },
}));

vi.mock("../db.js", () => {
  const client = transaction;
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
  getLimitsForOwner: vi.fn(() => ({
    scanMaxLockfileBytes: 1_000_000,
    scanAllowance: -1,
    entitlementPeriod: "week" as const,
    prCommentsEnabled: false,
    alertsEnabled: false,
  })),
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

  it("copies changeIntent onto the queue job and does not invent one", async () => {
    await createScanAndEnqueue({
      repoId: "acme/app",
      dependencyGraph: {},
      changeIntent: "change_request",
      github: {
        owner: "acme",
        repo: "app",
        prNumber: 4,
        headSha: "abc",
        installationId: 9,
      },
    });
    const withIntent = add.mock.calls[0]![1] as {
      changeIntent?: string;
      github?: { prNumber: number };
    };
    expect(withIntent.changeIntent).toBe("change_request");
    expect(withIntent.github?.prNumber).toBe(4);

    await createScanAndEnqueue({
      repoId: "acme/app",
      dependencyGraph: {},
      source: "manual",
    });
    const manual = add.mock.calls[1]![1] as { changeIntent?: string };
    expect(manual.changeIntent).toBeUndefined();

    await createScanAndEnqueue({
      repoId: "acme/app",
      dependencyGraph: {},
      source: "github",
    });
    const pushLike = add.mock.calls[2]![1] as {
      changeIntent?: string;
      github?: unknown;
    };
    expect(pushLike.changeIntent).toBeUndefined();
    expect(pushLike.github).toBeUndefined();
  });

  it("charges manual quota to the repoId owner and copies acquired facts without a GitHub source", async () => {
    const limited = {
      scanMaxLockfileBytes: 1_000_000,
      scanAllowance: 5,
      entitlementPeriod: "week" as const,
      prCommentsEnabled: false,
      alertsEnabled: false,
    };
    vi.mocked(getLimitsForOwner)
      .mockReturnValueOnce(limited)
      .mockReturnValueOnce(limited);
    const head = "a".repeat(40);
    await createScanAndEnqueue({
      repoId: "acme/scan-local",
      dependencyGraph: null,
      source: "manual",
      changeIntent: "change_request",
      acquiredFacts: {
        repoId: "acme/scan-local",
        changeIntent: "change_request",
        headRevision: { sha: head },
      },
    });
    expect(transaction.query).toHaveBeenCalledWith(
      expect.not.stringContaining("source='github'"),
      expect.arrayContaining(["acme"]),
    );
    const job = add.mock.calls[0]![1] as {
      acquiredFacts?: { headRevision: { sha: string } };
      repoSource?: unknown;
      github?: unknown;
    };
    expect(job.acquiredFacts?.headRevision.sha).toBe(head);
    expect(job.repoSource).toBeUndefined();
    expect(job.github).toBeUndefined();
  });
});
