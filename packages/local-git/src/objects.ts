import {
  decodeUtf8,
  isNotAGitRepository,
  parseCommitSha,
  runGit,
} from "./git-command.js";

/** Matches the private collection source-byte ceiling. */
export const LOCAL_BLOB_BYTE_LIMIT = 500_000;

/** One tree object listing. Larger output is reported incomplete. */
export const LOCAL_TREE_OUTPUT_BYTE_LIMIT = 1_048_576;

const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

export type LocalGitObjectFailure = "git_unavailable" | "failed";

export type LocalTreeEntry = {
  mode: string;
  type: "blob" | "tree" | "commit";
  objectId: string;
  path: string;
};

export type LocalTreeListing =
  | { kind: "complete"; entries: readonly LocalTreeEntry[] }
  | { kind: "truncated"; entries: readonly LocalTreeEntry[] }
  | { kind: LocalGitObjectFailure };

export type LocalBlobRead =
  | { kind: "bytes"; size: number; bytes: Uint8Array }
  | { kind: "oversized"; size: number }
  | { kind: LocalGitObjectFailure };

export type LocalPathRead =
  | {
      kind: "blob";
      mode: string;
      objectId: string;
      size: number;
      bytes: Uint8Array;
    }
  | {
      kind: "symlink";
      mode: string;
      objectId: string;
      size: number;
      linkText: Uint8Array;
    }
  | { kind: "tree"; mode: string; objectId: string }
  | { kind: "gitlink"; mode: string; objectId: string }
  | { kind: "oversized"; mode: string; objectId: string; size: number }
  | { kind: "absent" }
  | { kind: "rejected" }
  | { kind: LocalGitObjectFailure };

type GitOptions = {
  cwd: string;
  gitBinary?: string;
};

export async function listLocalTree(
  input: GitOptions & { treeId: string; maxOutputBytes?: number },
): Promise<LocalTreeListing> {
  if (!OBJECT_ID.test(input.treeId)) return { kind: "failed" };
  const listed = await runGit({
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    maxStdoutBytes: input.maxOutputBytes ?? LOCAL_TREE_OUTPUT_BYTE_LIMIT,
    args: ["ls-tree", "-z", "--end-of-options", input.treeId],
  });
  if (!listed.ok) return commandFailure(listed.reason);
  if (listed.timedOut || listed.stderrTruncated) return { kind: "failed" };
  if (!listed.stdoutTruncated && listed.exitCode !== 0)
    return { kind: "failed" };
  const parsed = parseTreeOutput(listed.stdout, listed.stdoutTruncated);
  if (parsed === null) return { kind: "failed" };
  if (listed.stdoutTruncated) {
    return { kind: "truncated", entries: parsed };
  }
  return { kind: "complete", entries: parsed };
}

export async function readLocalBlob(
  input: GitOptions & { blobId: string; maxBytes?: number },
): Promise<LocalBlobRead> {
  if (!OBJECT_ID.test(input.blobId)) return { kind: "failed" };
  const limit = input.maxBytes ?? LOCAL_BLOB_BYTE_LIMIT;
  const sized = await objectSize(input, input.blobId);
  if (typeof sized !== "number") return sized;
  if (sized > limit) return { kind: "oversized", size: sized };
  const body = await runGit({
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    maxStdoutBytes: sized,
    args: ["cat-file", "blob", "--end-of-options", input.blobId],
  });
  if (!body.ok) return commandFailure(body.reason);
  if (
    body.timedOut ||
    body.stdoutTruncated ||
    body.stderrTruncated ||
    body.exitCode !== 0 ||
    body.stdout.length !== sized
  ) {
    return { kind: "failed" };
  }
  return { kind: "bytes", size: sized, bytes: new Uint8Array(body.stdout) };
}

export async function readLocalPathAtRevision(
  input: GitOptions & { revision: string; path: string; maxBytes?: number },
): Promise<LocalPathRead> {
  if (isRejectedRepositoryPath(input.path)) return { kind: "rejected" };
  const commit = await resolveCommit(input, input.revision);
  if (commit === "git_unavailable" || commit === "failed") {
    return { kind: commit };
  }
  const listed = await runGit({
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    args: [
      "--literal-pathspecs",
      "ls-tree",
      "-z",
      "--end-of-options",
      commit,
      "--",
      input.path,
    ],
  });
  if (!listed.ok) return commandFailure(listed.reason);
  if (
    listed.timedOut ||
    listed.stdoutTruncated ||
    listed.stderrTruncated ||
    listed.exitCode !== 0
  ) {
    return { kind: "failed" };
  }
  const entries = parseTreeOutput(listed.stdout, false);
  if (entries === null) return { kind: "failed" };
  if (entries.length === 0) return { kind: "absent" };
  if (entries.length !== 1) return { kind: "failed" };
  const entry = entries[0];
  if (entry === undefined || entry.path !== input.path)
    return { kind: "failed" };
  if (entry.type === "tree") {
    return { kind: "tree", mode: entry.mode, objectId: entry.objectId };
  }
  if (entry.type === "commit") {
    return { kind: "gitlink", mode: entry.mode, objectId: entry.objectId };
  }
  const blob = await readLocalBlob({
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    blobId: entry.objectId,
    maxBytes: input.maxBytes,
  });
  if (blob.kind === "oversized") {
    return {
      kind: "oversized",
      mode: entry.mode,
      objectId: entry.objectId,
      size: blob.size,
    };
  }
  if (blob.kind !== "bytes") return { kind: blob.kind };
  if (entry.mode === "120000") {
    return {
      kind: "symlink",
      mode: entry.mode,
      objectId: entry.objectId,
      size: blob.size,
      linkText: blob.bytes,
    };
  }
  return {
    kind: "blob",
    mode: entry.mode,
    objectId: entry.objectId,
    size: blob.size,
    bytes: blob.bytes,
  };
}

export function isRejectedRepositoryPath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\")) {
    return true;
  }
  if (path.includes("\0")) return true;
  const segments = path.split("/");
  return segments.some((segment) => segment === "." || segment === "..");
}

function commandFailure(reason: "git_unavailable" | "git_failed"): {
  kind: LocalGitObjectFailure;
} {
  return { kind: reason === "git_unavailable" ? "git_unavailable" : "failed" };
}

async function objectSize(
  input: GitOptions,
  objectId: string,
): Promise<number | { kind: LocalGitObjectFailure }> {
  const sized = await runGit({
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    args: ["cat-file", "-s", "--end-of-options", objectId],
  });
  if (!sized.ok) return commandFailure(sized.reason);
  if (
    sized.timedOut ||
    sized.stdoutTruncated ||
    sized.stderrTruncated ||
    sized.exitCode !== 0
  ) {
    return { kind: "failed" };
  }
  const text = decodeUtf8(sized.stdout);
  if (text === null || !/^\d+\n?$/.test(text)) return { kind: "failed" };
  const size = Number(text.trim());
  if (!Number.isSafeInteger(size) || size < 0) return { kind: "failed" };
  return size;
}

async function resolveCommit(
  input: GitOptions,
  revision: string,
): Promise<string | LocalGitObjectFailure> {
  const resolved = await runGit({
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    args: ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`],
  });
  if (!resolved.ok) {
    return resolved.reason === "git_unavailable" ? "git_unavailable" : "failed";
  }
  if (
    resolved.timedOut ||
    resolved.stdoutTruncated ||
    resolved.stderrTruncated
  ) {
    return "failed";
  }
  if (resolved.exitCode !== 0 || isNotAGitRepository(resolved.stderr)) {
    return "failed";
  }
  return parseCommitSha(resolved.stdout) ?? "failed";
}

function parseTreeOutput(
  stdout: Buffer,
  truncated: boolean,
): readonly LocalTreeEntry[] | null {
  const entries: LocalTreeEntry[] = [];
  let start = 0;
  for (let index = 0; index <= stdout.length; index += 1) {
    if (index !== stdout.length && stdout[index] !== 0) continue;
    if (index === stdout.length) {
      if (start < stdout.length && !truncated) return null;
      break;
    }
    const record = stdout.subarray(start, index);
    start = index + 1;
    const entry = parseTreeRecord(record);
    if (entry === null) return null;
    entries.push(entry);
  }
  return entries;
}

function parseTreeRecord(record: Buffer): LocalTreeEntry | null {
  const tab = record.indexOf(0x09);
  if (tab < 0) return null;
  const header = decodeUtf8(record.subarray(0, tab));
  const path = decodeUtf8(record.subarray(tab + 1));
  if (header === null || path === null || path.length === 0) return null;
  const match =
    /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})$/i.exec(header);
  if (match === null) return null;
  const mode = match[1];
  const type = match[2];
  const objectId = match[3];
  if (mode === undefined || type === undefined || objectId === undefined) {
    return null;
  }
  if (type !== "blob" && type !== "tree" && type !== "commit") return null;
  return { mode, type, objectId: objectId.toLowerCase(), path };
}
