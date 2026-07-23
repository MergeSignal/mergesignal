import type { ScanRequest } from "@mergesignal/shared";
import { describe, expect, it } from "vitest";

import {
  hasVerifiedEmptyLockfileIngress,
  hasVerifiedLockfileIngress,
} from "./lockfile-evidence-ingress.js";

const emptyDelta = {
  added: [] as string[],
  removed: [] as string[],
  updated: [] as string[],
};
const addedDelta = {
  added: ["lodash"],
  removed: [] as string[],
  updated: [] as string[],
};
const removedDelta = {
  added: [] as string[],
  removed: ["lodash"],
  updated: [] as string[],
};
const updatedDelta = {
  added: [] as string[],
  removed: [] as string[],
  updated: ["lodash"],
};

describe("lockfile evidence ingress", () => {
  it("accepts verified empty with empty arrays", () => {
    const request = {
      lockfileEvidenceStatus: { kind: "verified", delta: "empty" },
      lockfilePackageDelta: emptyDelta,
    } as ScanRequest;
    expect(hasVerifiedLockfileIngress(request)).toBe(true);
    expect(hasVerifiedEmptyLockfileIngress(request)).toBe(true);
  });

  it("rejects verified empty with non-empty added packages", () => {
    const request = {
      lockfileEvidenceStatus: { kind: "verified", delta: "empty" },
      lockfilePackageDelta: addedDelta,
    } as ScanRequest;
    expect(hasVerifiedLockfileIngress(request)).toBe(false);
    expect(hasVerifiedEmptyLockfileIngress(request)).toBe(false);
  });

  it("rejects verified empty with non-empty removed packages", () => {
    const request = {
      lockfileEvidenceStatus: { kind: "verified", delta: "empty" },
      lockfilePackageDelta: removedDelta,
    } as ScanRequest;
    expect(hasVerifiedLockfileIngress(request)).toBe(false);
    expect(hasVerifiedEmptyLockfileIngress(request)).toBe(false);
  });

  it("rejects verified empty with non-empty updated packages", () => {
    const request = {
      lockfileEvidenceStatus: { kind: "verified", delta: "empty" },
      lockfilePackageDelta: updatedDelta,
    } as ScanRequest;
    expect(hasVerifiedLockfileIngress(request)).toBe(false);
    expect(hasVerifiedEmptyLockfileIngress(request)).toBe(false);
  });

  it("rejects verified changed with empty arrays for empty ingress", () => {
    const request = {
      lockfileEvidenceStatus: { kind: "verified", delta: "changed" },
      lockfilePackageDelta: emptyDelta,
    } as ScanRequest;
    expect(hasVerifiedLockfileIngress(request)).toBe(false);
    expect(hasVerifiedEmptyLockfileIngress(request)).toBe(false);
  });

  it("rejects unavailable evidence", () => {
    const request = {
      lockfileEvidenceStatus: {
        kind: "unavailable",
        reason: "incomplete_parse",
      },
      lockfilePackageDelta: emptyDelta,
    } as ScanRequest;
    expect(hasVerifiedLockfileIngress(request)).toBe(false);
    expect(hasVerifiedEmptyLockfileIngress(request)).toBe(false);
  });

  it("rejects missing lockfile delta", () => {
    const request = {
      lockfileEvidenceStatus: { kind: "verified", delta: "empty" },
    } as ScanRequest;
    expect(hasVerifiedLockfileIngress(request)).toBe(false);
    expect(hasVerifiedEmptyLockfileIngress(request)).toBe(false);
  });

  it("rejects contradictory verified changed status with non-empty delta for empty ingress", () => {
    const request = {
      lockfileEvidenceStatus: { kind: "verified", delta: "changed" },
      lockfilePackageDelta: addedDelta,
    } as ScanRequest;
    expect(hasVerifiedLockfileIngress(request)).toBe(true);
    expect(hasVerifiedEmptyLockfileIngress(request)).toBe(false);
  });
});
