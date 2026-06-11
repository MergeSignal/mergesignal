import { describe, expect, it } from "vitest";
import {
  parsePrHeadsQuery,
  resolvePrScanForHead,
  type PrScanDbRow,
} from "./resolvePrScanIndex.js";

function row(
  overrides: Partial<PrScanDbRow> & Pick<PrScanDbRow, "scan_id" | "status">,
): PrScanDbRow {
  return {
    decision: null,
    total_score: null,
    github_pr_number: 42,
    github_head_sha: "head-a",
    github_base_ref: "main",
    created_at: new Date("2026-01-01T00:00:00Z"),
    result_generated_at: null,
    result: null,
    github_surfaces_published_at: null,
    ...overrides,
  };
}

describe("parsePrHeadsQuery", () => {
  it("parses comma-separated pr:sha pairs", () => {
    const map = parsePrHeadsQuery("1:aaa,2:bbb");
    expect(map.get(1)).toBe("aaa");
    expect(map.get(2)).toBe("bbb");
  });

  it("ignores malformed segments", () => {
    expect(parsePrHeadsQuery("nope,3:").size).toBe(0);
  });
});

describe("resolvePrScanForHead", () => {
  it("prefers scanning over done rows for the same head", () => {
    const resolved = resolvePrScanForHead(
      [
        row({
          scan_id: "done-1",
          status: "done",
          github_head_sha: "head-a",
          result: { ok: true },
          github_surfaces_published_at: new Date(),
        }),
        row({ scan_id: "run-1", status: "running", github_head_sha: "head-a" }),
      ],
      42,
      "head-a",
    );
    expect(resolved?.presentationState).toBe("scanning");
    expect(resolved?.row.scan_id).toBe("run-1");
  });

  it("selects surfaces_incomplete before stale", () => {
    const resolved = resolvePrScanForHead(
      [
        row({
          scan_id: "old",
          status: "done",
          github_head_sha: "head-old",
          result: { ok: true },
          github_surfaces_published_at: new Date(),
        }),
        row({
          scan_id: "new",
          status: "done",
          github_head_sha: "head-a",
          result: { ok: true },
          github_surfaces_published_at: null,
        }),
      ],
      42,
      "head-a",
    );
    expect(resolved?.presentationState).toBe("surfaces_incomplete");
    expect(resolved?.row.scan_id).toBe("new");
  });
});
