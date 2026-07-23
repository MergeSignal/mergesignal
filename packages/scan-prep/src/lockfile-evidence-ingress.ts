import type { LockfilePackageDelta, ScanRequest } from "@mergesignal/shared";

type VerifiedLockfileStatus = { kind: "verified"; delta: "empty" | "changed" };

function isVerifiedLockfileStatus(
  status: ScanRequest["lockfileEvidenceStatus"],
): status is VerifiedLockfileStatus {
  return status?.kind === "verified";
}

function lockfileDeltaMatchesStatus(
  delta: LockfilePackageDelta,
  status: VerifiedLockfileStatus,
): boolean {
  const isEmpty =
    delta.added.length === 0 &&
    delta.removed.length === 0 &&
    delta.updated.length === 0;
  return status.delta === "empty" ? isEmpty : !isEmpty;
}

/** Canonical verified lockfile ingress — verified empty and verified changed. */
export function hasVerifiedLockfileIngress(
  request: Pick<ScanRequest, "lockfileEvidenceStatus" | "lockfilePackageDelta">,
): boolean {
  const status = request.lockfileEvidenceStatus;
  const delta = request.lockfilePackageDelta;
  if (!isVerifiedLockfileStatus(status) || delta === undefined) {
    return false;
  }
  return lockfileDeltaMatchesStatus(delta, status);
}

/** Verified-empty ingress — status/delta consistency with empty package transitions. */
export function hasVerifiedEmptyLockfileIngress(
  request: Pick<ScanRequest, "lockfileEvidenceStatus" | "lockfilePackageDelta">,
): boolean {
  const status = request.lockfileEvidenceStatus;
  if (!isVerifiedLockfileStatus(status) || status.delta !== "empty") {
    return false;
  }
  return hasVerifiedLockfileIngress(request);
}
