import { createHash } from "node:crypto";

export type GitObjectType = "commit" | "tree" | "blob";
type GitHashAlgorithm = "sha1" | "sha256";

type ParsedTreeEntry = {
  mode: string;
  path: string;
  sha: string;
  type: "blob" | "tree" | "commit";
};

export function hashAlgorithmForObjectId(
  objectId: string,
): GitHashAlgorithm | null {
  if (/^[0-9a-f]{40}$/i.test(objectId)) return "sha1";
  if (/^[0-9a-f]{64}$/i.test(objectId)) return "sha256";
  return null;
}

export function hashGitObject(
  type: GitObjectType,
  bytes: Uint8Array,
  algorithm: GitHashAlgorithm,
): string {
  const header = Buffer.from(`${type} ${bytes.byteLength}\0`);
  return createHash(algorithm).update(header).update(bytes).digest("hex");
}

/** Returns the Git type whose canonical hash equals the requested id. */
export function verifyGitObject(
  objectId: string,
  bytes: Uint8Array,
  allowed: readonly GitObjectType[],
): GitObjectType | null {
  const algorithm = hashAlgorithmForObjectId(objectId);
  if (!algorithm) return null;
  const expected = objectId.toLowerCase();
  for (const type of allowed) {
    if (hashGitObject(type, bytes, algorithm) === expected) return type;
  }
  return null;
}

export function parseCommitTreeId(bytes: Uint8Array): string | null {
  const text = Buffer.from(bytes).toString("utf8");
  const match = /^tree ([0-9a-f]{40}|[0-9a-f]{64})\n/i.exec(text);
  const tree = match?.[1];
  if (!tree) return null;
  return tree.toLowerCase();
}

function entryType(mode: string): ParsedTreeEntry["type"] {
  if (mode === "40000" || mode === "040000") return "tree";
  if (mode === "160000") return "commit";
  return "blob";
}

export function parseGitTree(
  bytes: Uint8Array,
  objectId: string,
): ParsedTreeEntry[] | null {
  const algorithm = hashAlgorithmForObjectId(objectId);
  if (!algorithm) return null;
  const oidBytes = algorithm === "sha256" ? 32 : 20;
  const buf = Buffer.from(bytes);
  const entries: ParsedTreeEntry[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const space = buf.indexOf(0x20, offset);
    if (space <= offset) return null;
    const mode = buf.toString("utf8", offset, space);
    if (!/^[0-9]+$/.test(mode)) return null;
    const nul = buf.indexOf(0x00, space + 1);
    if (nul <= space) return null;
    const path = buf.toString("utf8", space + 1, nul);
    if (path.length === 0 || path.includes("/") || path.includes("\\")) {
      return null;
    }
    const shaEnd = nul + 1 + oidBytes;
    if (shaEnd > buf.length) return null;
    const sha = buf.subarray(nul + 1, shaEnd).toString("hex");
    entries.push({ mode, path, sha, type: entryType(mode) });
    offset = shaEnd;
  }
  return entries;
}

export function isSafeRepoPath(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return false;
  }
  return path
    .split("/")
    .every(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    );
}
