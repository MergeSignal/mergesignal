import path from "node:path";

import {
  decodeUtf8,
  isNotAGitRepository,
  parseCommitSha,
  runGit,
} from "./git-command.js";

export type WorktreeCheckoutFailure =
  | "git_unavailable"
  | "not_a_git_repository"
  | "git_read_failed";

export type WorktreeCheckout = {
  /** Absolute git directory for this working tree, not the common directory. */
  gitDir: string;
  headCommit: string;
};

type GitIdentityInput = {
  cwd: string;
  gitBinary?: string;
};

/**
 * Worktree identity for a later result reference.
 * Reads the git directory and HEAD only. It does not compare history.
 */
export async function resolveWorktreeGitDir(
  input: GitIdentityInput,
): Promise<
  { ok: true; gitDir: string } | { ok: false; outcome: WorktreeCheckoutFailure }
> {
  const gitDir = await revParse(input, ["rev-parse", "--git-dir"]);
  if (!gitDir.ok) return gitDir;
  return { ok: true, gitDir: path.resolve(input.cwd, gitDir.value) };
}

export async function readWorktreeCheckout(
  input: GitIdentityInput,
): Promise<
  | ({ ok: true } & WorktreeCheckout)
  | { ok: false; outcome: WorktreeCheckoutFailure }
> {
  const gitDir = await resolveWorktreeGitDir(input);
  if (!gitDir.ok) return gitDir;
  const head = await revParse(input, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    "HEAD^{commit}",
  ]);
  if (!head.ok) return head;
  const sha = parseCommitSha(Buffer.from(head.value));
  if (sha === null) return { ok: false, outcome: "git_read_failed" };
  return { ok: true, gitDir: gitDir.gitDir, headCommit: sha };
}

async function revParse(
  input: GitIdentityInput,
  args: string[],
): Promise<
  { ok: true; value: string } | { ok: false; outcome: WorktreeCheckoutFailure }
> {
  const result = await runGit({
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    args,
  });
  if (!result.ok) {
    return {
      ok: false,
      outcome:
        result.reason === "git_unavailable"
          ? "git_unavailable"
          : "git_read_failed",
    };
  }
  if (result.timedOut || result.stdoutTruncated || result.stderrTruncated) {
    return { ok: false, outcome: "git_read_failed" };
  }
  if (result.exitCode !== 0) {
    return {
      ok: false,
      outcome: isNotAGitRepository(result.stderr)
        ? "not_a_git_repository"
        : "git_read_failed",
    };
  }
  const value = decodeUtf8(result.stdout)?.trim() ?? "";
  if (value.length === 0) return { ok: false, outcome: "git_read_failed" };
  return { ok: true, value };
}
