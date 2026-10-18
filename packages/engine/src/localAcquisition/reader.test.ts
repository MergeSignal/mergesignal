import { describe, expect, it } from "vitest";
import { hashGitObject } from "./gitObject.js";
import { createLocalRepositoryReader } from "./reader.js";
import type { RawObjectResult } from "./session.js";

function gitId(type: "blob" | "tree" | "commit", bytes: Uint8Array): string {
  return hashGitObject(type, bytes, "sha1");
}

function treeBody(
  entries: Array<{ mode: string; path: string; sha: string }>,
): Uint8Array {
  return Buffer.concat(
    entries.map((entry) =>
      Buffer.concat([
        Buffer.from(`${entry.mode} ${entry.path}\0`),
        Buffer.from(entry.sha, "hex"),
      ]),
    ),
  );
}

describe("local repository reader", () => {
  it("validates a commit, its tree, and a nested blob before exposing them", async () => {
    const file = Buffer.from("export const value = 1;\n");
    const fileId = gitId("blob", file);
    const link = Buffer.from("../elsewhere");
    const linkId = gitId("blob", link);
    const nested = treeBody([
      { mode: "100644", path: "app.ts", sha: fileId },
      { mode: "120000", path: "link", sha: linkId },
      { mode: "160000", path: "sub", sha: "b".repeat(40) },
      { mode: "40000", path: "dir", sha: "c".repeat(40) },
    ]);
    const nestedId = gitId("tree", nested);
    const root = treeBody([{ mode: "40000", path: "src", sha: nestedId }]);
    const rootId = gitId("tree", root);
    const commit = Buffer.from(`tree ${rootId}\n`);
    const commitId = gitId("commit", commit);
    const objects = new Map<string, Uint8Array>([
      [commitId, commit],
      [rootId, root],
      [nestedId, nested],
      [fileId, file],
      [linkId, link],
    ]);
    const requested: string[] = [];
    const reader = createLocalRepositoryReader({
      request: async (objectId): Promise<RawObjectResult> => {
        requested.push(objectId);
        const bytes = objects.get(objectId);
        if (!bytes) return { ok: false, reason: "rejected" };
        return { ok: true, bytes };
      },
    });

    const listing = await reader.listTree(commitId);
    expect(listing.truncated).toBe(false);
    expect(listing.entries).toEqual([
      { type: "tree", path: "src", sha: nestedId },
    ]);

    const blob = await reader.readBlob(fileId);
    expect(Buffer.from(blob.bytes).toString("utf8")).toBe(
      file.toString("utf8"),
    );

    const source = await reader.readFileAtRevision(commitId, "src/app.ts");
    expect(source).toEqual({
      kind: "file",
      sha: fileId,
      content: file.toString("utf8"),
    });
    const symlink = await reader.readFileAtRevision(commitId, "src/link");
    expect(symlink).toEqual({
      kind: "file",
      sha: linkId,
      content: "../elsewhere",
    });
    expect(requested).not.toContain("../elsewhere");
    expect(await reader.readFileAtRevision(commitId, "src/sub")).toEqual({
      kind: "rejected",
    });
    expect(await reader.readFileAtRevision(commitId, "src/dir")).toEqual({
      kind: "rejected",
    });
    expect(await reader.readFileAtRevision(commitId, "src/missing.ts")).toEqual(
      {
        kind: "absent",
      },
    );

    objects.set(fileId, Buffer.from("tampered"));
    await expect(reader.readBlob(fileId)).rejects.toThrow();
    expect(await reader.readFileAtRevision(commitId, "src/app.ts")).toEqual({
      kind: "failed",
    });
  });

  it("treats an oversized object as an acquisition failure", async () => {
    const reader = createLocalRepositoryReader({
      request: async () => ({ ok: false, reason: "oversized" }),
    });
    const blob = await reader.readBlob("a".repeat(40));
    expect(blob.size).toBeGreaterThan(500_000);
    expect(blob.bytes).toHaveLength(0);
    expect(await reader.readFileAtRevision("b".repeat(40), "a.ts")).toEqual({
      kind: "oversized",
    });
  });
});
