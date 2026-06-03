import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assertScanQuotaAvailable,
  countOwnerScansInWindow,
  getOwnerGithubQuotaStatus,
  GITHUB_SCAN_QUOTA_WINDOW_HOURS,
} from "./scanQuota.js";

vi.mock("../db.js", () => ({
  db: { query: vi.fn() },
}));

vi.mock("./tier.js", () => ({
  getLimitsForOwner: vi.fn(),
}));

import { db } from "../db.js";
import { getLimitsForOwner } from "./tier.js";

function mockLimits(overrides: {
  githubScansPerOwnerPerDay?: number;
  scansPerOwnerPerDay?: number;
}) {
  vi.mocked(getLimitsForOwner).mockReturnValue({
    scanMaxLockfileBytes: 1_000_000,
    scansPerOwnerPerDay: overrides.scansPerOwnerPerDay ?? 25,
    githubScansPerOwnerPerDay: overrides.githubScansPerOwnerPerDay ?? 15,
    prCommentsEnabled: false,
    alertsEnabled: false,
  });
}

describe("countOwnerScansInWindow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts github-scoped scans for github scope", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ c: 7 }],
      rowCount: 1,
    } as never);
    expect(await countOwnerScansInWindow("acme", "github")).toBe(7);
    expect(vi.mocked(db.query).mock.calls[0][0]).toContain("source='github'");
  });

  it("counts all owner scans for all scope", async () => {
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ c: 12 }],
      rowCount: 1,
    } as never);
    expect(await countOwnerScansInWindow("acme", "all")).toBe(12);
    expect(vi.mocked(db.query).mock.calls[0][0]).not.toContain(
      "source='github'",
    );
  });
});

describe("getOwnerGithubQuotaStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns state ok when usage is below limit", async () => {
    mockLimits({ githubScansPerOwnerPerDay: 15 });
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ c: 10 }],
      rowCount: 1,
    } as never);
    const status = await getOwnerGithubQuotaStatus("acme");
    expect(status).toEqual({
      source: "github",
      state: "ok",
      limit: 15,
      used: 10,
      windowHours: GITHUB_SCAN_QUOTA_WINDOW_HOURS,
    });
  });

  it("returns state exceeded when usage reaches configured limit", async () => {
    mockLimits({ githubScansPerOwnerPerDay: 20 });
    const oldest = new Date("2026-06-02T10:00:00Z");
    vi.mocked(db.query)
      .mockResolvedValueOnce({ rows: [{ c: 20 }], rowCount: 1 } as never)
      .mockResolvedValueOnce({
        rows: [{ created_at: oldest }],
        rowCount: 1,
      } as never);
    const status = await getOwnerGithubQuotaStatus("acme");
    expect(status.state).toBe("exceeded");
    expect(status.limit).toBe(20);
    expect(status.used).toBe(20);
  });

  it("never returns exceeded when limit is unlimited", async () => {
    mockLimits({ githubScansPerOwnerPerDay: -1 });
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ c: 999 }],
      rowCount: 1,
    } as never);
    const status = await getOwnerGithubQuotaStatus("acme");
    expect(status.state).toBe("ok");
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

describe("assertScanQuotaAvailable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws 429 when github quota is exceeded", async () => {
    mockLimits({ githubScansPerOwnerPerDay: 15 });
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ c: 15 }],
      rowCount: 1,
    } as never);
    await expect(
      assertScanQuotaAvailable("acme", "github"),
    ).rejects.toMatchObject({
      message: "scan quota exceeded",
      statusCode: 429,
      expose: true,
    });
  });

  it("does not throw when github usage is below limit", async () => {
    mockLimits({ githubScansPerOwnerPerDay: 15 });
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ c: 14 }],
      rowCount: 1,
    } as never);
    await expect(
      assertScanQuotaAvailable("acme", "github"),
    ).resolves.toBeUndefined();
  });

  it("uses all-scope count for manual source", async () => {
    mockLimits({ scansPerOwnerPerDay: 5 });
    vi.mocked(db.query).mockResolvedValue({
      rows: [{ c: 5 }],
      rowCount: 1,
    } as never);
    await expect(
      assertScanQuotaAvailable("acme", "manual"),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(vi.mocked(db.query).mock.calls[0][0]).not.toContain(
      "source='github'",
    );
  });

  it("skips check when limit is unlimited", async () => {
    mockLimits({ githubScansPerOwnerPerDay: -1 });
    await assertScanQuotaAvailable("acme", "github");
    expect(db.query).not.toHaveBeenCalled();
  });
});
