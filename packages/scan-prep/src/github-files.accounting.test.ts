import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoSource } from "@mergesignal/shared";

import {
  REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
  REPOSITORY_EVIDENCE_MAX_FILE_BYTES,
} from "./repository-evidence/corpusPolicy.js";
import { fetchGitHubFiles } from "./github-files.js";

const getInstallationToken = vi.fn();
const getTree = vi.fn();
const getBlob = vi.fn();

vi.mock("./github-auth.js", () => ({
  getInstallationToken: (...args: unknown[]) => getInstallationToken(...args),
}));

vi.mock("octokit", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      git: {
        getTree: (...args: unknown[]) => getTree(...args),
        getBlob: (...args: unknown[]) => getBlob(...args),
      },
    },
  })),
}));

const repoSource: RepoSource = {
  provider: "github",
  owner: "acme",
  repo: "app",
  sha: "deadbeef",
  installationId: 1,
};

function treeEntry(path: string, sha: string, size?: number) {
  return { type: "blob" as const, path, sha, size };
}

describe("fetchGitHubFiles acquisition accounting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInstallationToken.mockResolvedValue("token");
  });

  it("preserves 5000 eligible → 1000 selected → 4000 cap truncated with full fetch", async () => {
    const paths = Array.from(
      { length: 5_000 },
      (_, i) => `src/file-${String(i).padStart(5, "0")}.ts`,
    );
    getTree.mockResolvedValue({
      data: {
        tree: paths.map((path, i) => treeEntry(path, `sha-${i}`)),
      },
    });
    getBlob.mockImplementation(async () => ({
      data: {
        content: Buffer.from("export {};\n", "utf-8").toString("base64"),
        size: 12,
      },
    }));

    const result = await fetchGitHubFiles(repoSource);

    expect(result.repositoryEvidenceEligibleCandidateCount).toBe(5_000);
    expect(result.repositoryEvidenceSelectedCandidateCount).toBe(
      REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
    );
    expect(result.repositoryEvidenceCapTruncatedCandidateCount).toBe(4_000);
    expect(result.files.size).toBe(REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES);
    expect(result.sourceFilesSkippedOversized).toBe(0);
    expect(result.sourceFilesSkippedFetchError).toBe(0);
    expect(result.sourceFilesSkipped).toBe(0);
    expect(getBlob).toHaveBeenCalledTimes(
      REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
    );
  });

  it("counts oversized selected files without cap truncation", async () => {
    getTree.mockResolvedValue({
      data: {
        tree: [
          treeEntry(
            "src/huge.ts",
            "sha-huge",
            REPOSITORY_EVIDENCE_MAX_FILE_BYTES + 1,
          ),
        ],
      },
    });
    getBlob.mockResolvedValue({
      data: {
        content: Buffer.from("x", "utf-8").toString("base64"),
        size: REPOSITORY_EVIDENCE_MAX_FILE_BYTES + 1,
      },
    });

    const result = await fetchGitHubFiles(repoSource);

    expect(result.repositoryEvidenceSelectedCandidateCount).toBe(1);
    expect(result.repositoryEvidenceCapTruncatedCandidateCount).toBe(0);
    expect(result.sourceFilesSkippedOversized).toBe(1);
    expect(result.sourceFilesSkippedFetchError).toBe(0);
    expect(result.sourceFilesSkipped).toBe(1);
    expect(result.files.size).toBe(0);
  });

  it("counts fetch errors without cap truncation", async () => {
    getTree.mockResolvedValue({
      data: { tree: [treeEntry("src/fail.ts", "sha-fail")] },
    });
    getBlob.mockRejectedValue(new Error("boom"));

    const result = await fetchGitHubFiles(repoSource);

    expect(result.repositoryEvidenceSelectedCandidateCount).toBe(1);
    expect(result.repositoryEvidenceCapTruncatedCandidateCount).toBe(0);
    expect(result.sourceFilesSkippedFetchError).toBe(1);
    expect(result.sourceFilesSkippedOversized).toBe(0);
    expect(result.sourceFilesSkipped).toBe(1);
    expect(result.files.size).toBe(0);
  });

  it("keeps cap truncation and acquisition skips independently observable", async () => {
    const paths = Array.from(
      { length: REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES + 5 },
      (_, i) => `src/file-${i}.ts`,
    );
    getTree.mockResolvedValue({
      data: {
        tree: paths.map((path, i) => treeEntry(path, `sha-${i}`)),
      },
    });
    getBlob.mockImplementation(async ({ file_sha }: { file_sha: string }) => {
      if (file_sha === "sha-0") {
        throw new Error("fail first");
      }
      return {
        data: {
          content: Buffer.from("ok", "utf-8").toString("base64"),
          size: 2,
        },
      };
    });

    const result = await fetchGitHubFiles(repoSource);

    expect(result.repositoryEvidenceCapTruncatedCandidateCount).toBe(5);
    expect(result.sourceFilesSkippedFetchError).toBe(1);
    expect(result.sourceFilesSkipped).toBe(1);
    expect(result.files.size).toBe(REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES - 1);
  });
});
