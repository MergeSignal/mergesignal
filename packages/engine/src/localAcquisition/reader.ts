import { MAX_OBJECT_BYTES } from "./limits.js";
import {
  isSafeRepoPath,
  parseCommitTreeId,
  parseGitTree,
  verifyGitObject,
  type GitObjectType,
} from "./gitObject.js";
import type { RawObjectResult } from "./session.js";
import type { ProductionRepositoryReader } from "../productionAnalyzeOptions.js";

type ObjectRequest = (objectId: string) => Promise<RawObjectResult>;

/** One in-process queue so Collection's concurrent reads share one Redis slot. */
function serializeObjectRequests(request: ObjectRequest): ObjectRequest {
  let tail: Promise<void> = Promise.resolve();
  return (objectId) => {
    const run = tail.then(() => request(objectId));
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

class ObjectAdmissionError extends Error {
  constructor(
    readonly reason: "oversized" | "mismatch" | "malformed" | "unavailable",
  ) {
    super(reason);
  }
}

async function loadVerified(
  request: ObjectRequest,
  objectId: string,
  allowed: readonly GitObjectType[],
): Promise<{ type: GitObjectType; bytes: Uint8Array }> {
  const loaded = await request(objectId);
  if (!loaded.ok) {
    if (loaded.reason === "oversized") {
      throw new ObjectAdmissionError("oversized");
    }
    throw new ObjectAdmissionError("unavailable");
  }
  if (loaded.bytes.byteLength > MAX_OBJECT_BYTES) {
    throw new ObjectAdmissionError("oversized");
  }
  const type = verifyGitObject(objectId, loaded.bytes, allowed);
  if (!type) throw new ObjectAdmissionError("mismatch");
  return { type, bytes: loaded.bytes };
}

export function createLocalRepositoryReader(input: {
  request: ObjectRequest;
}): ProductionRepositoryReader {
  const request = serializeObjectRequests(input.request);

  return {
    async listTree(objectId: string) {
      const loaded = await loadVerified(request, objectId, ["commit", "tree"]);
      let treeId = objectId.toLowerCase();
      let treeBytes = loaded.bytes;
      if (loaded.type === "commit") {
        const parsed = parseCommitTreeId(loaded.bytes);
        if (!parsed) throw new ObjectAdmissionError("malformed");
        const tree = await loadVerified(request, parsed, ["tree"]);
        treeId = parsed;
        treeBytes = tree.bytes;
      }
      const entries = parseGitTree(treeBytes, treeId);
      if (!entries) throw new ObjectAdmissionError("malformed");
      return {
        entries: entries.map((entry) => ({
          type: entry.type,
          path: entry.path,
          sha: entry.sha,
        })),
        truncated: false,
      };
    },

    async readBlob(blobId: string) {
      try {
        const loaded = await loadVerified(request, blobId, ["blob"]);
        return { size: loaded.bytes.byteLength, bytes: loaded.bytes };
      } catch (error: unknown) {
        if (
          error instanceof ObjectAdmissionError &&
          error.reason === "oversized"
        ) {
          return { size: MAX_OBJECT_BYTES + 1, bytes: new Uint8Array() };
        }
        throw error;
      }
    },

    async readFileAtRevision(revisionRef: string, repoRelativePath: string) {
      if (!isSafeRepoPath(repoRelativePath)) return { kind: "rejected" };
      try {
        const commit = await loadVerified(request, revisionRef, ["commit"]);
        const rootTree = parseCommitTreeId(commit.bytes);
        if (!rootTree) return { kind: "failed" };
        let treeId = rootTree;
        const segments = repoRelativePath.split("/");
        for (let index = 0; index < segments.length; index += 1) {
          const segment = segments[index];
          if (!segment) return { kind: "rejected" };
          const tree = await loadVerified(request, treeId, ["tree"]);
          const entries = parseGitTree(tree.bytes, treeId);
          if (!entries) return { kind: "failed" };
          const entry = entries.find((item) => item.path === segment);
          if (!entry) return { kind: "absent" };
          const last = index === segments.length - 1;
          if (!last) {
            if (entry.type !== "tree") return { kind: "rejected" };
            treeId = entry.sha;
            continue;
          }
          if (entry.mode === "120000") {
            const link = await loadVerified(request, entry.sha, ["blob"]);
            return {
              kind: "file",
              sha: entry.sha,
              content: Buffer.from(link.bytes).toString("utf8"),
            };
          }
          if (entry.type !== "blob") return { kind: "rejected" };
          const blob = await loadVerified(request, entry.sha, ["blob"]);
          if (blob.bytes.byteLength > MAX_OBJECT_BYTES) {
            return { kind: "oversized" };
          }
          return {
            kind: "file",
            sha: entry.sha,
            content: Buffer.from(blob.bytes).toString("utf8"),
          };
        }
        return { kind: "absent" };
      } catch (error: unknown) {
        if (
          error instanceof ObjectAdmissionError &&
          error.reason === "oversized"
        ) {
          return { kind: "oversized" };
        }
        return { kind: "failed" };
      }
    },
  };
}
