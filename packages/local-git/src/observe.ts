import {
  hasVerifiedEmptyLockfileIngress,
  prepareLockfileContext,
  type LockfileContextResult,
} from "@mergesignal/scan-prep/lockfile";

import {
  decodeUtf8,
  isNotAGitRepository,
  parseCommitSha,
  runGit,
  type GitCommandResult,
} from "./git-command.js";
import {
  isRejectedRepositoryPath,
  readLocalPathAtRevision,
  type LocalPathRead,
} from "./objects.js";

const LOCKFILE_CANDIDATES = [
  { path: "pnpm-lock.yaml", manager: "pnpm" },
  { path: "package-lock.json", manager: "npm" },
  { path: "yarn.lock", manager: "yarn" },
] as const;

export type LockfileManager = (typeof LOCKFILE_CANDIDATES)[number]["manager"];

export type LocalGitFailureOutcome =
  | "git_unavailable"
  | "not_a_git_repository"
  | "base_required"
  | "invalid_base"
  | "uncommitted_changes"
  | "history_insufficient"
  | "git_read_failed";

export type LocalChangedPath =
  | { status: "added"; path: string }
  | { status: "modified"; path: string }
  | { status: "deleted"; path: string }
  | { status: "renamed"; from: string; to: string };

export type LocalLockfileFact =
  | {
      availability: "compared";
      path: string;
      manager: LockfileManager;
      headContent?: string;
      baseContent?: string;
      preparation: LockfileContextResult;
    }
  | {
      availability: "oversized" | "not_file";
      path: string;
      manager: LockfileManager;
    };

type Comparison = {
  repositoryRoot: string;
  headCommit: string;
  baseCommit: string;
  mergeBaseCommit: string;
  changedPaths: readonly LocalChangedPath[];
};

export type LocalGitObservation =
  | { ok: false; outcome: LocalGitFailureOutcome }
  | ({ ok: true; outcome: "no_dependency_upgrade_episode" } & Comparison)
  | ({
      ok: true;
      outcome: "ready";
      lockfile: LocalLockfileFact;
    } & Comparison);

export type ObserveLocalGitInput = {
  cwd: string;
  /** Commit-ish resolved locally. Omitted means the configured upstream. */
  base?: string;
  gitBinary?: string;
};

type GitCall = {
  cwd: string;
  gitBinary?: string;
};

export async function observeLocalGit(
  input: ObserveLocalGitInput,
): Promise<LocalGitObservation> {
  const root = await runGit({
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    args: ["rev-parse", "--show-toplevel"],
  });
  if (!root.ok) return failure(root.reason);
  if (root.timedOut || root.stdoutTruncated || root.stderrTruncated) {
    return { ok: false, outcome: "git_read_failed" };
  }
  if (root.exitCode !== 0) {
    return {
      ok: false,
      outcome: isNotAGitRepository(root.stderr)
        ? "not_a_git_repository"
        : "git_read_failed",
    };
  }
  const repositoryRoot = decodeUtf8(root.stdout)?.trim() ?? null;
  if (repositoryRoot === null || repositoryRoot.length === 0) {
    return { ok: false, outcome: "git_read_failed" };
  }

  const git: GitCall = { cwd: repositoryRoot, gitBinary: input.gitBinary };
  const head = await resolveCommit(git, "HEAD^{commit}");
  if (!head.ok) {
    return {
      ok: false,
      outcome: head.outcome === "unresolved" ? "git_read_failed" : head.outcome,
    };
  }

  const base = await resolveBase(git, input.base);
  if (!base.ok) return base;

  const shallow = await runGit({
    ...git,
    args: ["rev-parse", "--is-shallow-repository"],
  });
  const shallowText = textResult(shallow);
  if (!shallowText.ok) return shallowText;
  if (shallowText.value.trim() === "true") {
    return { ok: false, outcome: "history_insufficient" };
  }

  const mergeBase = await mergeBaseCommit(git, base.value, head.value);
  if (!mergeBase.ok) return mergeBase;

  const dirty = await trackedDrift(git);
  if (dirty !== null) return { ok: false, outcome: dirty };

  const changed = await changedPaths(git, base.value, head.value);
  if (!changed.ok) return changed;

  const comparison: Comparison = {
    repositoryRoot,
    headCommit: head.value,
    baseCommit: base.value,
    mergeBaseCommit: mergeBase.value,
    changedPaths: changed.paths,
  };
  return finishLockfile(git, comparison);
}

/**
 * Webhook selection order: each supported name, exact path, then one nested path.
 * Nested pnpm wins over an exact package-lock.
 */
function selectLockfile(
  paths: readonly string[],
): { path: string; manager: LockfileManager } | null {
  for (const candidate of LOCKFILE_CANDIDATES) {
    const exact = paths.find((path) => path === candidate.path);
    if (exact !== undefined) return { path: exact, manager: candidate.manager };
    const nested = paths.find((path) => path.endsWith(`/${candidate.path}`));
    if (nested !== undefined) {
      return { path: nested, manager: candidate.manager };
    }
  }
  return null;
}

function selectionPaths(changes: readonly LocalChangedPath[]): string[] {
  const paths: string[] = [];
  for (const change of changes) {
    paths.push(change.status === "renamed" ? change.to : change.path);
  }
  return paths;
}

async function finishLockfile(
  git: GitCall,
  comparison: Comparison,
): Promise<LocalGitObservation> {
  const selected = selectLockfile(selectionPaths(comparison.changedPaths));
  if (selected === null) {
    return {
      ok: true,
      outcome: "no_dependency_upgrade_episode",
      ...comparison,
    };
  }
  if (isRejectedRepositoryPath(selected.path)) {
    return { ok: false, outcome: "git_read_failed" };
  }

  const head = await readLockfileSide(
    git,
    comparison.headCommit,
    selected.path,
  );
  if ("outcome" in head) return { ok: false, outcome: head.outcome };
  const base = await readLockfileSide(
    git,
    comparison.baseCommit,
    selected.path,
  );
  if ("outcome" in base) return { ok: false, outcome: base.outcome };
  if (head.availability === "oversized" || base.availability === "oversized") {
    return {
      ok: true,
      outcome: "ready",
      ...comparison,
      lockfile: { availability: "oversized", ...selected },
    };
  }
  if (head.availability === "not_file" || base.availability === "not_file") {
    return {
      ok: true,
      outcome: "ready",
      ...comparison,
      lockfile: { availability: "not_file", ...selected },
    };
  }
  if (head.availability === "absent" && base.availability === "absent") {
    return { ok: false, outcome: "git_read_failed" };
  }

  const preparation = prepareLockfileContext({
    scanId: "local-git",
    repoId: "local-git",
    dependencyGraph: null,
    changedFiles: selectionPaths(comparison.changedPaths),
    ...(head.availability === "present"
      ? {
          lockfile: {
            manager: selected.manager,
            content: head.content,
            path: selected.path,
          },
        }
      : {}),
    ...(base.availability === "present"
      ? {
          baseLockfile: {
            manager: selected.manager,
            content: base.content,
            path: selected.path,
          },
        }
      : {}),
  });

  if (
    hasVerifiedEmptyLockfileIngress({
      lockfileEvidenceStatus: preparation.evidenceStatus,
      lockfilePackageDelta: preparation.lockfilePackageDelta,
    })
  ) {
    return {
      ok: true,
      outcome: "no_dependency_upgrade_episode",
      ...comparison,
    };
  }

  return {
    ok: true,
    outcome: "ready",
    ...comparison,
    lockfile: {
      availability: "compared",
      ...selected,
      ...(head.availability === "present" ? { headContent: head.content } : {}),
      ...(base.availability === "present" ? { baseContent: base.content } : {}),
      preparation,
    },
  };
}

type LockfileSide =
  | { availability: "present"; content: string }
  | { availability: "absent" }
  | { availability: "oversized" | "not_file" }
  | { outcome: LocalGitFailureOutcome };

async function readLockfileSide(
  git: GitCall,
  revision: string,
  path: string,
): Promise<LockfileSide> {
  const read = await readLocalPathAtRevision({
    cwd: git.cwd,
    gitBinary: git.gitBinary,
    revision,
    path,
  });
  return classifyLockfileRead(read);
}

function classifyLockfileRead(read: LocalPathRead): LockfileSide {
  if (read.kind === "absent") return { availability: "absent" };
  if (read.kind === "oversized") return { availability: "oversized" };
  if (
    read.kind === "tree" ||
    read.kind === "gitlink" ||
    read.kind === "symlink"
  ) {
    return { availability: "not_file" };
  }
  if (read.kind === "git_unavailable") return { outcome: "git_unavailable" };
  if (read.kind !== "blob") return { outcome: "git_read_failed" };
  const content = decodeUtf8(Buffer.from(read.bytes));
  if (content === null) return { outcome: "git_read_failed" };
  return { availability: "present", content };
}

async function resolveBase(
  git: GitCall,
  explicit: string | undefined,
): Promise<GitValue> {
  if (explicit !== undefined) {
    if (explicit.length === 0) return stopped("invalid_base");
    const resolved = await resolveCommit(git, `${explicit}^{commit}`);
    if (!resolved.ok) {
      return stopped(
        resolved.outcome === "unresolved" ? "invalid_base" : resolved.outcome,
      );
    }
    return resolved;
  }

  const symbolic = await runGit({
    ...git,
    args: ["symbolic-ref", "-q", "HEAD"],
  });
  if (!symbolic.ok) return failure(symbolic.reason);
  if (
    symbolic.timedOut ||
    symbolic.stdoutTruncated ||
    symbolic.stderrTruncated
  ) {
    return stopped("git_read_failed");
  }
  if (symbolic.exitCode !== 0) return stopped("base_required");
  const ref = decodeUtf8(symbolic.stdout)?.trim() ?? "";
  const branch = ref.startsWith("refs/heads/")
    ? ref.slice("refs/heads/".length)
    : "";
  if (branch.length === 0) return stopped("git_read_failed");

  const remote = await configGet(git, `branch.${branch}.remote`);
  if (!remote.ok) return remote;
  const merge = await configGet(git, `branch.${branch}.merge`);
  if (!merge.ok) return merge;
  if (remote.value.length === 0 || merge.value.length === 0) {
    return stopped("base_required");
  }

  const upstream = await resolveCommit(git, "@{upstream}^{commit}");
  if (!upstream.ok) {
    return stopped(
      upstream.outcome === "unresolved"
        ? "history_insufficient"
        : upstream.outcome,
    );
  }
  return upstream;
}

async function configGet(
  git: GitCall,
  key: string,
): Promise<
  { ok: true; value: string } | { ok: false; outcome: LocalGitFailureOutcome }
> {
  const result = await runGit({
    ...git,
    args: ["config", "--get", "--end-of-options", key],
  });
  if (!result.ok) return { ok: false, outcome: failure(result.reason).outcome };
  if (result.timedOut || result.stdoutTruncated || result.stderrTruncated) {
    return { ok: false, outcome: "git_read_failed" };
  }
  if (result.exitCode === 1) return { ok: true, value: "" };
  if (result.exitCode !== 0) return { ok: false, outcome: "git_read_failed" };
  const value = decodeUtf8(result.stdout)?.trim() ?? null;
  if (value === null) return { ok: false, outcome: "git_read_failed" };
  return { ok: true, value };
}

async function trackedDrift(
  git: GitCall,
): Promise<LocalGitFailureOutcome | null> {
  const diff = await runGit({
    ...git,
    args: [
      "diff",
      "--quiet",
      "--no-ext-diff",
      "--no-textconv",
      "--ignore-submodules=dirty",
      "--end-of-options",
      "HEAD",
    ],
  });
  if (!diff.ok) return failure(diff.reason).outcome;
  if (diff.timedOut || diff.stdoutTruncated || diff.stderrTruncated) {
    return "git_read_failed";
  }
  if (diff.exitCode === 0) return null;
  if (diff.exitCode === 1) return "uncommitted_changes";
  return "git_read_failed";
}

async function changedPaths(
  git: GitCall,
  base: string,
  head: string,
): Promise<PathList> {
  const diff = await runGit({
    ...git,
    args: [
      "diff",
      "-z",
      "--name-status",
      "--find-renames",
      "--no-ext-diff",
      "--no-textconv",
      "--end-of-options",
      `${base}...${head}`,
    ],
  });
  if (!diff.ok) return failure(diff.reason);
  if (
    diff.timedOut ||
    diff.stdoutTruncated ||
    diff.stderrTruncated ||
    diff.exitCode !== 0
  ) {
    return stopped("git_read_failed");
  }
  return parseNameStatus(diff.stdout);
}

function parseNameStatus(stdout: Buffer): PathList {
  const fields: string[] = [];
  let start = 0;
  for (let index = 0; index <= stdout.length; index += 1) {
    if (index !== stdout.length && stdout[index] !== 0) continue;
    if (index === stdout.length) {
      if (start < stdout.length) return stopped("git_read_failed");
      break;
    }
    const text = decodeUtf8(stdout.subarray(start, index));
    if (text === null) return stopped("git_read_failed");
    fields.push(text);
    start = index + 1;
  }

  const changes: LocalChangedPath[] = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index];
    const path = fields[index + 1];
    if (status === undefined || path === undefined)
      return stopped("git_read_failed");
    if (status.startsWith("R")) {
      const to = fields[index + 2];
      if (to === undefined) return stopped("git_read_failed");
      changes.push({ status: "renamed", from: path, to });
      index += 3;
      continue;
    }
    if (status === "A") changes.push({ status: "added", path });
    else if (status === "D") changes.push({ status: "deleted", path });
    else if (status === "M" || status === "T") {
      changes.push({ status: "modified", path });
    } else {
      return stopped("git_read_failed");
    }
    index += 2;
  }
  return { ok: true, paths: changes };
}

async function mergeBaseCommit(
  git: GitCall,
  base: string,
  head: string,
): Promise<GitValue> {
  const result = await runGit({
    ...git,
    args: ["merge-base", "--end-of-options", base, head],
  });
  if (!result.ok) return failure(result.reason);
  if (result.timedOut || result.stdoutTruncated || result.stderrTruncated) {
    return stopped("git_read_failed");
  }
  if (result.exitCode !== 0) return stopped("history_insufficient");
  const sha = parseCommitSha(result.stdout);
  return sha === null ? stopped("git_read_failed") : { ok: true, value: sha };
}

async function resolveCommit(
  git: GitCall,
  revision: string,
): Promise<GitValue | { ok: false; outcome: "unresolved" }> {
  const result = await runGit({
    ...git,
    args: ["rev-parse", "--verify", "--end-of-options", revision],
  });
  if (!result.ok) return failure(result.reason);
  if (result.timedOut || result.stdoutTruncated || result.stderrTruncated) {
    return stopped("git_read_failed");
  }
  if (result.exitCode !== 0) return { ok: false, outcome: "unresolved" };
  const sha = parseCommitSha(result.stdout);
  return sha === null ? stopped("git_read_failed") : { ok: true, value: sha };
}

function textResult(result: GitCommandResult): GitValue {
  if (!result.ok) return failure(result.reason);
  if (
    result.timedOut ||
    result.stdoutTruncated ||
    result.stderrTruncated ||
    result.exitCode !== 0
  ) {
    return stopped("git_read_failed");
  }
  const text = decodeUtf8(result.stdout);
  return text === null ? stopped("git_read_failed") : { ok: true, value: text };
}

type PathList =
  | { ok: true; paths: readonly LocalChangedPath[] }
  | { ok: false; outcome: LocalGitFailureOutcome };

type GitValue =
  | { ok: true; value: string }
  | { ok: false; outcome: LocalGitFailureOutcome };

function stopped(outcome: LocalGitFailureOutcome): {
  ok: false;
  outcome: LocalGitFailureOutcome;
} {
  return { ok: false, outcome };
}

function failure(reason: "git_unavailable" | "git_failed"): {
  ok: false;
  outcome: LocalGitFailureOutcome;
} {
  return {
    ok: false,
    outcome:
      reason === "git_unavailable" ? "git_unavailable" : "git_read_failed",
  };
}
