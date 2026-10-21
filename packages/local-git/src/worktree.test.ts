import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createRepo,
  removeRepos,
  runGit,
  track,
  writeAndCommit,
} from "../test/repo.js";
import { readWorktreeCheckout, resolveWorktreeGitDir } from "./worktree.js";

afterEach(removeRepos);

describe("worktree git directory", () => {
  it("uses this working tree's git directory", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "init");

    const resolved = await resolveWorktreeGitDir({ cwd: dir });
    const checkout = await readWorktreeCheckout({ cwd: dir });

    expect(resolved).toEqual({ ok: true, gitDir: path.join(dir, ".git") });
    expect(checkout.ok).toBe(true);
    if (!checkout.ok) return;
    expect(checkout.gitDir).toBe(path.join(dir, ".git"));
    expect(checkout.headCommit).toHaveLength(40);
  });

  it("keeps a linked worktree separate from the common git directory", async () => {
    const main = await createRepo();
    await writeAndCommit(main, { "a.txt": "a\n" }, "init");
    const parent = path.dirname(main);
    const linked = path.join(parent, "linked");
    await track(linked);
    await runGit(main, ["worktree", "add", "-q", "-b", "other", linked]);

    const mainDir = await resolveWorktreeGitDir({ cwd: main });
    const linkedDir = await resolveWorktreeGitDir({ cwd: linked });

    expect(mainDir).toEqual({ ok: true, gitDir: path.join(main, ".git") });
    expect(linkedDir.ok).toBe(true);
    if (!linkedDir.ok) return;
    expect(linkedDir.gitDir).not.toBe(path.join(main, ".git"));
    expect(linkedDir.gitDir).toContain(
      `${path.sep}.git${path.sep}worktrees${path.sep}`,
    );
  });

  it("does not treat two repositories with the same folder name as one checkout", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ms-same-name-"));
    await track(root);
    const first = path.join(root, "left", "repo");
    const second = path.join(root, "right", "repo");
    await mkdir(first, { recursive: true });
    await mkdir(second, { recursive: true });
    await runGit(first, ["init", "-q", "-b", "main"]);
    await runGit(second, ["init", "-q", "-b", "main"]);

    const left = await resolveWorktreeGitDir({ cwd: first });
    const right = await resolveWorktreeGitDir({ cwd: second });
    expect(left).toEqual({ ok: true, gitDir: path.join(first, ".git") });
    expect(right).toEqual({ ok: true, gitDir: path.join(second, ".git") });
  });

  it("fails closed outside a repository", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "ms-not-git-"));
    await track(dir);
    await writeFile(path.join(dir, "a.txt"), "a\n");

    await expect(resolveWorktreeGitDir({ cwd: dir })).resolves.toEqual({
      ok: false,
      outcome: "not_a_git_repository",
    });
    await expect(readWorktreeCheckout({ cwd: dir })).resolves.toEqual({
      ok: false,
      outcome: "not_a_git_repository",
    });
  });
});
