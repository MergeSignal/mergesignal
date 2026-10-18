import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { observeLocalGit } from "./observe.js";
import {
  createRepo,
  npmLock,
  removeRepos,
  runGit,
  track,
  writeAndCommit,
} from "../test/repo.js";

afterEach(removeRepos);

describe("repository and base", () => {
  it("resolves an attached branch to its configured local upstream", async () => {
    const dir = await createRepo();
    const main = await writeAndCommit(dir, { "a.txt": "a\n" }, "main");
    await runGit(dir, ["checkout", "-q", "-b", "feature"]);
    await writeAndCommit(dir, { "b.txt": "b\n" }, "feature");
    await runGit(dir, ["branch", "--set-upstream-to=main"]);

    const observed = await observeLocalGit({ cwd: dir });

    expect(observed.ok).toBe(true);
    if (!observed.ok) return;
    expect(observed.baseCommit).toBe(main);
    expect(observed.outcome).toBe("no_dependency_upgrade_episode");
    expect(observed.changedPaths).toEqual([{ status: "added", path: "b.txt" }]);
  });

  it("resolves an explicit base and a detached HEAD with that base", async () => {
    const dir = await createRepo();
    const base = await writeAndCommit(dir, { "a.txt": "a\n" }, "base");
    const head = await writeAndCommit(dir, { "b.txt": "b\n" }, "head");
    await runGit(dir, ["checkout", "-q", "--detach"]);

    const observed = await observeLocalGit({ cwd: dir, base });

    expect(observed.ok).toBe(true);
    if (!observed.ok) return;
    expect(observed.headCommit).toBe(head);
    expect(observed.baseCommit).toBe(base);
    expect(observed.changedPaths).toEqual([{ status: "added", path: "b.txt" }]);
  });

  it("requires a base for detached HEAD", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "a");
    await runGit(dir, ["checkout", "-q", "--detach"]);

    await expect(observeLocalGit({ cwd: dir })).resolves.toEqual({
      ok: false,
      outcome: "base_required",
    });
  });

  it("requires a base when the attached branch has no upstream", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "a");
    await runGit(dir, ["checkout", "-q", "-b", "feature"]);

    await expect(observeLocalGit({ cwd: dir })).resolves.toEqual({
      ok: false,
      outcome: "base_required",
    });
  });

  it("does not report a configured but locally missing upstream as base_required", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "a");
    await runGit(dir, ["checkout", "-q", "-b", "feature"]);
    await runGit(dir, ["config", "branch.feature.remote", "."]);
    await runGit(dir, ["config", "branch.feature.merge", "refs/heads/gone"]);

    await expect(observeLocalGit({ cwd: dir })).resolves.toEqual({
      ok: false,
      outcome: "history_insufficient",
    });
  });

  it("rejects an explicit base that does not resolve locally", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "a");

    await expect(
      observeLocalGit({ cwd: dir, base: "not-a-commit" }),
    ).resolves.toEqual({ ok: false, outcome: "invalid_base" });
  });
});

describe("comparison and history", () => {
  it("uses three-dot changes from the merge base", async () => {
    const dir = await createRepo();
    const root = await writeAndCommit(dir, { "a.txt": "a\n" }, "root");
    await runGit(dir, ["checkout", "-q", "-b", "feature"]);
    await writeAndCommit(dir, { "topic.txt": "topic\n" }, "topic");
    await runGit(dir, ["checkout", "-q", "main"]);
    await writeAndCommit(dir, { "main.txt": "main\n" }, "main");
    await runGit(dir, ["checkout", "-q", "feature"]);

    const observed = await observeLocalGit({ cwd: dir, base: "main" });

    expect(observed.ok).toBe(true);
    if (!observed.ok) return;
    expect(observed.mergeBaseCommit).toBe(root);
    expect(observed.changedPaths).toEqual([
      { status: "added", path: "topic.txt" },
    ]);
  });

  it("preserves rename and deletion paths", async () => {
    const dir = await createRepo();
    await writeAndCommit(
      dir,
      { "old name.txt": "keep\n", "gone.txt": "gone\n" },
      "base",
    );
    await runGit(dir, ["mv", "old name.txt", "new name.txt"]);
    await runGit(dir, ["rm", "gone.txt"]);
    await runGit(dir, ["commit", "-q", "-m", "edit"]);

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed.ok).toBe(true);
    if (!observed.ok) return;
    expect(observed.changedPaths).toHaveLength(2);
    expect(observed.changedPaths).toContainEqual({
      status: "renamed",
      from: "old name.txt",
      to: "new name.txt",
    });
    expect(observed.changedPaths).toContainEqual({
      status: "deleted",
      path: "gone.txt",
    });
  });

  it("preserves a newline in a committed path", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "base");
    const weird = path.join(dir, "foo\nbar.txt");
    await writeFile(weird, "weird\n");
    await runGit(dir, ["add", "--", "foo\nbar.txt"]);
    await runGit(dir, ["commit", "-q", "-m", "weird"]);

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed.ok).toBe(true);
    if (!observed.ok) return;
    expect(observed.changedPaths).toEqual([
      { status: "added", path: "foo\nbar.txt" },
    ]);
  });

  it("returns no dependency episode when base and HEAD are the same commit", async () => {
    const dir = await createRepo();
    const head = await writeAndCommit(dir, { "a.txt": "a\n" }, "only");

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD" });

    expect(observed).toMatchObject({
      ok: true,
      outcome: "no_dependency_upgrade_episode",
      headCommit: head,
      baseCommit: head,
      mergeBaseCommit: head,
      changedPaths: [],
    });
  });

  it("returns history_insufficient for a shallow repository", async () => {
    const source = await createRepo();
    await writeAndCommit(source, { "a.txt": "a\n" }, "first");
    await writeAndCommit(source, { "b.txt": "b\n" }, "second");
    const shallow = path.join(path.dirname(source), "shallow");
    await track(shallow);
    await runGit(source, [
      "clone",
      "--depth",
      "1",
      "--no-local",
      source,
      shallow,
    ]);

    await expect(
      observeLocalGit({ cwd: shallow, base: "HEAD" }),
    ).resolves.toEqual({ ok: false, outcome: "history_insufficient" });
  });

  it("returns history_insufficient when the commits have no merge base", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "main");
    await runGit(dir, ["checkout", "-q", "--orphan", "other"]);
    await runGit(dir, ["rm", "-rf", "--", "."]);
    await writeAndCommit(dir, { "other.txt": "o\n" }, "other");

    await expect(observeLocalGit({ cwd: dir, base: "main" })).resolves.toEqual({
      ok: false,
      outcome: "history_insufficient",
    });
  });
});

describe("dirty state", () => {
  it("blocks staged and unstaged tracked changes", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "base");

    await writeFile(path.join(dir, "a.txt"), "staged\n");
    await runGit(dir, ["add", "--", "a.txt"]);
    await expect(observeLocalGit({ cwd: dir, base: "HEAD" })).resolves.toEqual({
      ok: false,
      outcome: "uncommitted_changes",
    });

    await runGit(dir, ["restore", "--staged", "--worktree", "--", "a.txt"]);
    await writeFile(path.join(dir, "a.txt"), "unstaged\n");
    await expect(observeLocalGit({ cwd: dir, base: "HEAD" })).resolves.toEqual({
      ok: false,
      outcome: "uncommitted_changes",
    });
  });

  it("does not block untracked or ignored files", async () => {
    const dir = await createRepo();
    await writeAndCommit(
      dir,
      { "a.txt": "a\n", ".gitignore": "ignored.txt\n" },
      "base",
    );
    await writeFile(path.join(dir, "untracked.txt"), "u\n");
    await writeFile(path.join(dir, "ignored.txt"), "i\n");

    await expect(
      observeLocalGit({ cwd: dir, base: "HEAD" }),
    ).resolves.toMatchObject({
      ok: true,
      outcome: "no_dependency_upgrade_episode",
    });
  });

  it("ignores submodule worktree dirt unless the gitlink differs", async () => {
    const sub = await createRepo();
    const subHead = await writeAndCommit(sub, { "s.txt": "s\n" }, "sub");
    const parent = await createRepo();
    await writeAndCommit(parent, { "a.txt": "a\n" }, "parent");
    await runGit(parent, [
      "update-index",
      "--add",
      "--cacheinfo",
      `160000,${subHead},vendor`,
    ]);
    await runGit(parent, ["commit", "-q", "-m", "link"]);
    await runGit(parent, ["clone", sub, "vendor"]);
    await writeFile(path.join(parent, "vendor", "s.txt"), "dirty\n");

    await expect(
      observeLocalGit({ cwd: parent, base: "HEAD" }),
    ).resolves.toMatchObject({
      ok: true,
      outcome: "no_dependency_upgrade_episode",
    });

    const next = await writeAndCommit(sub, { "s.txt": "next\n" }, "next");
    await runGit(parent, [
      "update-index",
      "--cacheinfo",
      `160000,${next},vendor`,
    ]);
    await expect(
      observeLocalGit({ cwd: parent, base: "HEAD" }),
    ).resolves.toEqual({ ok: false, outcome: "uncommitted_changes" });
  });
});

describe("dependency episode", () => {
  it("returns exact base and head bytes for a supported lockfile change", async () => {
    const dir = await createRepo();
    const baseLock = npmLock({ lodash: "4.17.20" });
    const headLock = npmLock({ lodash: "4.17.21" });
    await writeAndCommit(dir, { "package-lock.json": baseLock }, "base");
    await writeAndCommit(dir, { "package-lock.json": headLock }, "head");

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed.ok).toBe(true);
    if (!observed.ok || observed.outcome !== "ready") {
      throw new Error("expected a ready lockfile observation");
    }
    expect(observed.lockfile).toMatchObject({
      availability: "compared",
      path: "package-lock.json",
      manager: "npm",
      baseContent: baseLock,
      headContent: headLock,
    });
    if (observed.lockfile.availability !== "compared") return;
    expect(observed.lockfile.preparation.evidenceStatus).toEqual({
      kind: "verified",
      delta: "changed",
    });
    expect(observed.lockfile.preparation.changedPackages).toContain("lodash");
  });

  it("returns no episode for a verified empty package delta", async () => {
    const dir = await createRepo();
    await writeAndCommit(
      dir,
      { "package-lock.json": npmLock({ lodash: "4.17.21" }) },
      "base",
    );
    await writeAndCommit(
      dir,
      { "package-lock.json": npmLock({ lodash: "4.17.21" }, true) },
      "head",
    );

    await expect(
      observeLocalGit({ cwd: dir, base: "HEAD~1" }),
    ).resolves.toMatchObject({
      ok: true,
      outcome: "no_dependency_upgrade_episode",
    });
  });

  it("returns no episode when no supported lockfile changed", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "README.md": "a\n" }, "base");
    await writeAndCommit(dir, { "README.md": "b\n" }, "head");

    await expect(
      observeLocalGit({ cwd: dir, base: "HEAD~1" }),
    ).resolves.toMatchObject({
      ok: true,
      outcome: "no_dependency_upgrade_episode",
    });
  });

  it("keeps an added lockfile as missing base evidence", async () => {
    const dir = await createRepo();
    const headLock = npmLock({ lodash: "4.17.21" });
    await writeAndCommit(dir, { "README.md": "a\n" }, "base");
    await writeAndCommit(dir, { "package-lock.json": headLock }, "add");

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed).toMatchObject({
      ok: true,
      outcome: "ready",
      lockfile: {
        availability: "compared",
        path: "package-lock.json",
        headContent: headLock,
        preparation: {
          evidenceStatus: { kind: "unavailable", reason: "missing_base" },
          changedPackages: [],
        },
      },
    });
    if (!observed.ok || observed.outcome !== "ready") return;
    if (observed.lockfile.availability !== "compared") return;
    expect(observed.lockfile.baseContent).toBeUndefined();
  });

  it("keeps a deleted lockfile as missing head evidence", async () => {
    const dir = await createRepo();
    const baseLock = npmLock({ lodash: "4.17.21" });
    await writeAndCommit(dir, { "package-lock.json": baseLock }, "base");
    await runGit(dir, ["rm", "package-lock.json"]);
    await runGit(dir, ["commit", "-q", "-m", "delete"]);

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed).toMatchObject({
      ok: true,
      outcome: "ready",
      lockfile: {
        availability: "compared",
        path: "package-lock.json",
        baseContent: baseLock,
        preparation: {
          evidenceStatus: { kind: "unavailable", reason: "missing_head" },
          changedPackages: [],
        },
      },
    });
    if (!observed.ok || observed.outcome !== "ready") return;
    if (observed.lockfile.availability !== "compared") return;
    expect(observed.lockfile.headContent).toBeUndefined();
  });

  it("keeps a renamed lockfile on the new path as missing base evidence", async () => {
    const dir = await createRepo();
    const lock = npmLock({ lodash: "4.17.21" });
    await writeAndCommit(dir, { "package-lock.json": lock }, "base");
    await mkdir(path.join(dir, "packages", "app"), { recursive: true });
    await runGit(dir, [
      "mv",
      "package-lock.json",
      "packages/app/package-lock.json",
    ]);
    await runGit(dir, ["commit", "-q", "-m", "rename"]);

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed.ok).toBe(true);
    if (!observed.ok || observed.outcome !== "ready") {
      throw new Error("renamed lockfile must not become an empty episode");
    }
    expect(observed.changedPaths).toContainEqual({
      status: "renamed",
      from: "package-lock.json",
      to: "packages/app/package-lock.json",
    });
    expect(observed.lockfile).toMatchObject({
      path: "packages/app/package-lock.json",
      manager: "npm",
      headContent: lock,
      preparation: {
        evidenceStatus: { kind: "unavailable", reason: "missing_base" },
      },
    });
  });

  it("does not read through a symlinked lockfile", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "README.md": "a\n" }, "base");
    await writeFile(path.join(dir, "real.lock"), npmLock({ lodash: "1.0.0" }));
    await symlink("real.lock", path.join(dir, "package-lock.json"));
    await runGit(dir, ["add", "--", "package-lock.json"]);
    await runGit(dir, ["commit", "-q", "-m", "link"]);

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed).toMatchObject({
      ok: true,
      outcome: "ready",
      lockfile: {
        availability: "not_file",
        path: "package-lock.json",
        manager: "npm",
      },
    });
  });

  it("prefers a nested pnpm lockfile over an exact npm lockfile", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "README.md": "a\n" }, "base");
    await writeAndCommit(
      dir,
      {
        "package-lock.json": npmLock({}),
        "packages/app/pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
      },
      "both",
    );

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed.ok).toBe(true);
    if (!observed.ok || observed.outcome !== "ready") {
      throw new Error("expected the pnpm lockfile to be selected");
    }
    expect(observed.lockfile).toMatchObject({
      path: "packages/app/pnpm-lock.yaml",
      manager: "pnpm",
    });
  });
});

describe("observation failures", () => {
  it("reports a missing git executable", async () => {
    const dir = await createRepo();
    await expect(
      observeLocalGit({ cwd: dir, gitBinary: path.join(dir, "missing-git") }),
    ).resolves.toEqual({ ok: false, outcome: "git_unavailable" });
  });

  it("reports a directory that is not a repository", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "ms-not-a-repo-"));
    await track(empty);

    await expect(observeLocalGit({ cwd: empty })).resolves.toEqual({
      ok: false,
      outcome: "not_a_git_repository",
    });
  });

  it("reports a repository whose HEAD cannot be read", async () => {
    const dir = await createRepo();

    await expect(observeLocalGit({ cwd: dir, base: "HEAD" })).resolves.toEqual({
      ok: false,
      outcome: "git_read_failed",
    });
  });
});

describe("untrusted repository helpers", () => {
  it("does not execute a configured external diff during observation", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "base");
    await writeAndCommit(dir, { "a.txt": "b\n" }, "head");
    const { script, log } = await installSentinel(dir);
    await runGit(dir, ["config", "diff.external", script]);

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed.ok).toBe(true);
    await expect(readFile(log, "utf8")).rejects.toThrow();
  });

  it("does not execute a configured fsmonitor during observation", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n" }, "base");
    await writeAndCommit(dir, { "a.txt": "b\n" }, "head");
    const { script, log } = await installSentinel(dir);
    await runGit(dir, ["config", "core.fsmonitor", script]);

    const observed = await observeLocalGit({ cwd: dir, base: "HEAD~1" });

    expect(observed.ok).toBe(true);
    await expect(readFile(log, "utf8")).rejects.toThrow();
  });
});

describe("package boundary", () => {
  it("stays private and has no publish configuration", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { private?: boolean; publishConfig?: unknown };

    expect(manifest.private).toBe(true);
    expect(manifest.publishConfig).toBeUndefined();
  });
});

async function installSentinel(
  dir: string,
): Promise<{ script: string; log: string }> {
  const log = path.join(dir, "sentinel.log");
  const script = path.join(dir, "sentinel.sh");
  await writeFile(
    script,
    `#!/bin/sh\nprintf '%s\\n' ran >> ${shellQuote(log)}\nexit 0\n`,
  );
  await chmod(script, 0o755);
  return { script, log };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
