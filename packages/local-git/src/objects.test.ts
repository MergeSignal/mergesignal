import { createHash } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import {
  LOCAL_BLOB_BYTE_LIMIT,
  listLocalTree,
  readLocalBlob,
  readLocalObject,
  readLocalPathAtRevision,
} from "./objects.js";
import {
  createRepo,
  removeRepos,
  runGit,
  track,
  writeAndCommit,
} from "../test/repo.js";

const exec = promisify(execFile);

afterEach(removeRepos);

describe("raw object acquisition", () => {
  it("lists immediate tree entries and exact blob bytes", async () => {
    const dir = await createRepo();
    const body = Buffer.from("exact-bytes\n");
    await writeAndCommit(dir, { "dir/file.txt": body.toString("utf8") }, "add");
    const tree = (await runGit(dir, ["rev-parse", "HEAD^{tree}"])).trim();

    const listing = await listLocalTree({ cwd: dir, treeId: tree });

    expect(listing.kind).toBe("complete");
    if (listing.kind !== "complete") return;
    expect(listing.entries).toEqual([
      expect.objectContaining({
        mode: "040000",
        type: "tree",
        path: "dir",
      }),
    ]);
    const child = (await runGit(dir, ["rev-parse", "HEAD:dir"])).trim();
    const nested = await listLocalTree({ cwd: dir, treeId: child });
    expect(nested.kind).toBe("complete");
    if (nested.kind !== "complete") return;
    const file = nested.entries[0];
    expect(file).toMatchObject({
      mode: "100644",
      type: "blob",
      path: "file.txt",
    });
    if (file === undefined) return;

    const blob = await readLocalBlob({ cwd: dir, blobId: file.objectId });
    expect(blob).toMatchObject({ kind: "bytes", size: body.length });
    if (blob.kind !== "bytes") return;
    expect(Buffer.from(blob.bytes).equals(body)).toBe(true);
  });

  it("preserves an executable mode and does not follow a symlink", async () => {
    const dir = await createRepo();
    await writeFile(path.join(dir, "run.sh"), "echo hi\n");
    await runGit(dir, ["add", "--chmod=+x", "--", "run.sh"]);
    const secret = path.join(dir, "secret.txt");
    await writeFile(secret, "SECRET-CONTENTS\n");
    await symlink("secret.txt", path.join(dir, "link.txt"));
    await runGit(dir, ["add", "--", "link.txt"]);
    await runGit(dir, ["commit", "-q", "-m", "modes"]);
    const tree = (await runGit(dir, ["rev-parse", "HEAD^{tree}"])).trim();

    const listing = await listLocalTree({ cwd: dir, treeId: tree });
    expect(listing.kind).toBe("complete");
    if (listing.kind !== "complete") return;
    expect(listing.entries).toContainEqual(
      expect.objectContaining({ mode: "100755", type: "blob", path: "run.sh" }),
    );
    expect(listing.entries).toContainEqual(
      expect.objectContaining({
        mode: "120000",
        type: "blob",
        path: "link.txt",
      }),
    );

    const executable = await readLocalPathAtRevision({
      cwd: dir,
      revision: "HEAD",
      path: "run.sh",
    });
    expect(executable).toMatchObject({ kind: "blob", mode: "100755" });

    const link = await readLocalPathAtRevision({
      cwd: dir,
      revision: "HEAD",
      path: "link.txt",
    });
    expect(link.kind).toBe("symlink");
    if (link.kind !== "symlink") return;
    expect(Buffer.from(link.linkText).toString("utf8")).toBe("secret.txt");
    expect(Buffer.from(link.linkText).toString("utf8")).not.toContain("SECRET");
  });

  it("does not treat a tree or gitlink as file bytes", async () => {
    const sub = await createRepo();
    const subHead = await writeAndCommit(sub, { "s.txt": "s\n" }, "sub");
    const dir = await createRepo();
    await writeAndCommit(dir, { "dir/file.txt": "f\n" }, "tree");
    await runGit(dir, [
      "update-index",
      "--add",
      "--cacheinfo",
      `160000,${subHead},vendor`,
    ]);
    await runGit(dir, ["commit", "-q", "-m", "link"]);

    const tree = await readLocalPathAtRevision({
      cwd: dir,
      revision: "HEAD",
      path: "dir",
    });
    expect(tree).toMatchObject({ kind: "tree", mode: "040000" });
    expect(tree).not.toHaveProperty("bytes");

    const gitlink = await readLocalPathAtRevision({
      cwd: dir,
      revision: "HEAD",
      path: "vendor",
    });
    expect(gitlink).toMatchObject({
      kind: "gitlink",
      mode: "160000",
      objectId: subHead,
    });
    expect(gitlink).not.toHaveProperty("bytes");
  });

  it("rejects an oversized blob before reading its bytes", async () => {
    const dir = await createRepo();
    const log = path.join(dir, "git.log");
    const wrapper = await gitWrapper(dir, log);
    const body = Buffer.alloc(LOCAL_BLOB_BYTE_LIMIT + 1, 0x61);
    await writeFile(path.join(dir, "big.bin"), body);
    await runGit(dir, ["add", "--", "big.bin"]);
    await runGit(dir, ["commit", "-q", "-m", "big"]);
    const blobId = (await runGit(dir, ["rev-parse", "HEAD:big.bin"])).trim();

    const blob = await readLocalBlob({
      cwd: dir,
      blobId,
      gitBinary: wrapper,
    });
    const atPath = await readLocalPathAtRevision({
      cwd: dir,
      revision: "HEAD",
      path: "big.bin",
      gitBinary: wrapper,
    });

    expect(blob).toEqual({ kind: "oversized", size: body.length });
    expect(atPath).toMatchObject({
      kind: "oversized",
      mode: "100644",
      size: body.length,
    });
    const trace = await readFile(log, "utf8");
    expect(trace).toContain("cat-file -s");
    expect(trace).not.toContain("cat-file blob");
  });

  it("reports a bounded tree listing as truncated without a partial entry", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "a\n", "b.txt": "b\n" }, "files");
    const tree = (await runGit(dir, ["rev-parse", "HEAD^{tree}"])).trim();
    const firstRecordBytes = Buffer.from(
      `100644 blob ${"0".repeat(40)}\ta.txt\0`,
    ).length;

    const cutInside = await listLocalTree({
      cwd: dir,
      treeId: tree,
      maxOutputBytes: firstRecordBytes - 1,
    });
    const one = await listLocalTree({
      cwd: dir,
      treeId: tree,
      maxOutputBytes: firstRecordBytes,
    });
    const complete = await listLocalTree({ cwd: dir, treeId: tree });

    expect(cutInside).toEqual({ kind: "truncated", entries: [] });
    expect(one.kind).toBe("truncated");
    if (one.kind !== "truncated") return;
    expect(one.entries.map((entry) => entry.path)).toEqual(["a.txt"]);
    expect(complete.kind).toBe("complete");
    if (complete.kind !== "complete") return;
    expect(complete.entries.map((entry) => entry.path)).toEqual([
      "a.txt",
      "b.txt",
    ]);
  });

  it("rejects unsafe paths before invoking git and reads odd filenames", async () => {
    const dir = await createRepo();
    const log = path.join(dir, "git.log");
    const wrapper = await gitWrapper(dir, log);
    await writeAndCommit(dir, { "--looks-like-flag": "flag-body\n" }, "flag");

    await expect(
      readLocalPathAtRevision({
        cwd: dir,
        revision: "HEAD",
        path: "../secret",
        gitBinary: wrapper,
      }),
    ).resolves.toEqual({ kind: "rejected" });
    await expect(readFile(log, "utf8")).rejects.toThrow();

    const read = await readLocalPathAtRevision({
      cwd: dir,
      revision: "HEAD",
      path: "--looks-like-flag",
    });
    expect(read.kind).toBe("blob");
    if (read.kind !== "blob") return;
    expect(Buffer.from(read.bytes).toString("utf8")).toBe("flag-body\n");
  });

  it("reads pathspec-looking names as literal paths", async () => {
    const dir = await createRepo();
    const files: Record<string, string> = {
      "README.md": "ordinary\n",
      ":README.md": "colon\n",
      ":(top)README.md": "magic\n",
      "star*.txt": "star\n",
      "starX.txt": "star-other\n",
      "que?.txt": "question\n",
      "queX.txt": "question-other\n",
      "bra[ck].txt": "bracket\n",
      "bracket.txt": "bracket-other\n",
    };
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(path.join(dir, name), contents);
    }
    await runGit(dir, [
      "--literal-pathspecs",
      "add",
      "--",
      ...Object.keys(files),
    ]);
    await runGit(dir, ["commit", "-q", "-m", "names"]);

    for (const [name, contents] of Object.entries(files)) {
      const read = await readLocalPathAtRevision({
        cwd: dir,
        revision: "HEAD",
        path: name,
      });
      expect(read.kind, name).toBe("blob");
      if (read.kind !== "blob") return;
      expect(Buffer.from(read.bytes).toString("utf8"), name).toBe(contents);
    }

    await expect(
      readLocalPathAtRevision({
        cwd: dir,
        revision: "HEAD",
        path: "README-missing.md",
      }),
    ).resolves.toEqual({ kind: "absent" });
  });

  it("reports git failures for object reads", async () => {
    const dir = await createRepo();
    await expect(
      readLocalBlob({
        cwd: dir,
        blobId: "a".repeat(40),
        gitBinary: path.join(dir, "missing-git"),
      }),
    ).resolves.toEqual({ kind: "git_unavailable" });

    const empty = path.join(dir, "empty");
    await mkdir(empty);
    await expect(
      listLocalTree({ cwd: empty, treeId: "a".repeat(40) }),
    ).resolves.toEqual({ kind: "failed" });
  });
});

describe("exact raw object read", () => {
  it("rehashes a committed blob, commit, and multi-entry tree", async () => {
    const dir = await createRepo();
    await writeAndCommit(
      dir,
      { "a.txt": "alpha\n", "b.txt": "beta\n" },
      "two files",
    );
    const commit = (await runGit(dir, ["rev-parse", "HEAD"])).trim();
    const tree = (await runGit(dir, ["rev-parse", "HEAD^{tree}"])).trim();
    const blob = (await runGit(dir, ["rev-parse", "HEAD:a.txt"])).trim();
    const pretty = await runGit(dir, ["ls-tree", tree]);

    const commitRead = await readLocalObject({ cwd: dir, objectId: commit });
    const treeRead = await readLocalObject({ cwd: dir, objectId: tree });
    const blobRead = await readLocalObject({ cwd: dir, objectId: blob });

    expect(commitRead.kind).toBe("bytes");
    expect(treeRead.kind).toBe("bytes");
    expect(blobRead.kind).toBe("bytes");
    if (
      commitRead.kind !== "bytes" ||
      treeRead.kind !== "bytes" ||
      blobRead.kind !== "bytes"
    ) {
      return;
    }
    expect(commitRead.type).toBe("commit");
    expect(treeRead.type).toBe("tree");
    expect(blobRead.type).toBe("blob");
    expect(gitObjectHash("commit", commitRead.bytes)).toBe(commit);
    expect(gitObjectHash("tree", treeRead.bytes)).toBe(tree);
    expect(gitObjectHash("blob", blobRead.bytes)).toBe(blob);
    expect(treeRead.bytes.includes(0)).toBe(true);
    expect(Buffer.from(treeRead.bytes).toString("utf8")).not.toBe(pretty);
    expect(Buffer.from(blobRead.bytes).toString("utf8")).toBe("alpha\n");

    await writeFile(path.join(dir, "a.txt"), "worktree-only\n");
    const reread = await readLocalObject({ cwd: dir, objectId: blob });
    expect(reread).toMatchObject({ kind: "bytes", type: "blob" });
    if (reread.kind !== "bytes") return;
    expect(Buffer.from(reread.bytes).toString("utf8")).toBe("alpha\n");
  });

  it("uses cat-file type and raw type, not pretty output", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "alpha\n" }, "one");
    const blob = (await runGit(dir, ["rev-parse", "HEAD:a.txt"])).trim();
    const log = path.join(dir, "git-args");
    const wrapper = await gitWrapper(dir, log);

    const read = await readLocalObject({
      cwd: dir,
      gitBinary: wrapper,
      objectId: blob,
    });

    expect(read.kind).toBe("bytes");
    const commands = (await readFile(log, "utf8")).trim().split("\n");
    expect(commands.some((line) => line.includes("cat-file -t "))).toBe(true);
    expect(commands.some((line) => line.includes("cat-file blob "))).toBe(true);
    expect(commands.some((line) => line.includes(" -p"))).toBe(false);
  });

  it("rejects malformed ids, missing objects, tags, oversized objects, and timeouts", async () => {
    const dir = await createRepo();
    await writeAndCommit(dir, { "a.txt": "alpha\n" }, "one");
    await runGit(dir, ["tag", "-a", "v1", "-m", "annotated", "HEAD"]);
    const tag = (await runGit(dir, ["rev-parse", "v1"])).trim();

    await expect(
      readLocalObject({ cwd: dir, objectId: "HEAD" }),
    ).resolves.toEqual({ kind: "failed" });
    await expect(
      readLocalObject({ cwd: dir, objectId: "a".repeat(40) }),
    ).resolves.toEqual({ kind: "failed" });
    await expect(readLocalObject({ cwd: dir, objectId: tag })).resolves.toEqual(
      { kind: "unsupported_type" },
    );

    const big = Buffer.alloc(LOCAL_BLOB_BYTE_LIMIT + 1, 1);
    await writeFile(path.join(dir, "big.bin"), big);
    await runGit(dir, ["add", "--", "big.bin"]);
    await runGit(dir, ["commit", "-q", "-m", "big"]);
    const oversized = (await runGit(dir, ["rev-parse", "HEAD:big.bin"])).trim();
    await expect(
      readLocalObject({ cwd: dir, objectId: oversized }),
    ).resolves.toEqual({
      kind: "oversized",
      size: LOCAL_BLOB_BYTE_LIMIT + 1,
    });

    const slow = path.join(dir, "slow-git");
    writeFileSync(slow, "#!/bin/sh\nsleep 30\n");
    chmodSync(slow, 0o755);
    const started = Date.now();
    await expect(
      readLocalObject({
        cwd: dir,
        gitBinary: slow,
        objectId: oversized,
        timeoutMs: 200,
      }),
    ).resolves.toEqual({ kind: "failed" });
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});

function gitObjectHash(type: string, bytes: Uint8Array): string {
  return createHash("sha1")
    .update(`${type} ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
}

async function gitWrapper(dir: string, log: string): Promise<string> {
  const { stdout } = await exec("which", ["git"]);
  const realGit = stdout.toString("utf8").trim();
  const wrapper = path.join(dir, "git-wrapper");
  writeFileSync(
    wrapper,
    `#!/bin/sh\nprintf '%s\\n' "$*" >> ${shellQuote(log)}\nexec ${shellQuote(realGit)} "$@"\n`,
  );
  chmodSync(wrapper, 0o755);
  track(dir);
  return wrapper;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
