import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashGitObject,
  parseCommitTreeId,
  parseGitTree,
  verifyGitObject,
} from "./gitObject.js";

describe("git object admission", () => {
  it("matches the canonical empty blob sha1", () => {
    expect(hashGitObject("blob", new Uint8Array(), "sha1")).toBe(
      "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
    );
  });

  it("hashes sha256 objects as 64 hex characters", () => {
    const bytes = Buffer.from("test");
    const expected = createHash("sha256")
      .update(`blob ${bytes.byteLength}\0`)
      .update(bytes)
      .digest("hex");
    expect(hashGitObject("blob", bytes, "sha256")).toBe(expected);
    expect(expected).toHaveLength(64);
  });

  it("rejects a hash mismatch and a malformed tree or commit", () => {
    const bytes = Buffer.from("nope");
    expect(verifyGitObject("a".repeat(40), bytes, ["blob"])).toBeNull();
    expect(parseCommitTreeId(Buffer.from("parent abc\n"))).toBeNull();
    expect(parseGitTree(Buffer.from("not-a-tree"), "a".repeat(40))).toBeNull();
  });

  it("parses a tree only after the caller has its object id", () => {
    const blob = Buffer.from("hello");
    const blobId = hashGitObject("blob", blob, "sha1");
    const treeBody = Buffer.concat([
      Buffer.from(`100644 hello.txt\0`),
      Buffer.from(blobId, "hex"),
    ]);
    const treeId = hashGitObject("tree", treeBody, "sha1");
    expect(parseGitTree(treeBody, treeId)).toEqual([
      { mode: "100644", path: "hello.txt", sha: blobId, type: "blob" },
    ]);
    const commit = Buffer.from(`tree ${treeId}\n`);
    expect(parseCommitTreeId(commit)).toBe(treeId);
    expect(verifyGitObject(treeId, treeBody, ["tree"])).toBe("tree");
  });
});
