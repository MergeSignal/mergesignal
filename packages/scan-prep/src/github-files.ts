import type { RepoSource } from "@mergesignal/shared";
import { Octokit } from "octokit";

import { getInstallationToken } from "./github-auth.js";
import { logInfo, logWarn } from "./log.js";
import {
  aggregateSourceFilesSkipped,
  type RepositoryEvidenceAcquisitionAccounting,
} from "./repository-evidence-acquisition-accounting.js";
import {
  REPOSITORY_EVIDENCE_MAX_FILE_BYTES,
  selectRepositoryEvidenceCandidatePaths,
} from "./repository-evidence/corpusPolicy.js";

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const BATCH_SIZE = 10;

export interface FetchOptions {
  /** Operational fetch timeout only; does not change evidence policy. */
  timeoutMs?: number;
}

export interface FetchResult {
  files: Map<string, string>;
  /**
   * Cap-selected paths not retrieved as UTF-8 content (size limit or fetch failure).
   * Excludes repository-evidence cap truncation and ineligible paths.
   */
  sourceFilesSkipped: number;
  repositoryEvidenceEligibleCandidateCount: number;
  repositoryEvidenceSelectedCandidateCount: number;
  repositoryEvidenceCapTruncatedCandidateCount: number;
  sourceFilesSkippedOversized: number;
  sourceFilesSkippedFetchError: number;
}

function defaultFetchTimeoutMs(): number {
  const raw = process.env.CODE_ANALYSIS_TIMEOUT_MS;
  const n = raw ? Number(raw) : DEFAULT_FETCH_TIMEOUT_MS;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_FETCH_TIMEOUT_MS;
}

export async function fetchGitHubFiles(
  repoSource: RepoSource,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? defaultFetchTimeoutMs();

  return Promise.race([
    fetchFilesInternal(repoSource),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("File fetch timeout")), timeoutMs),
    ),
  ]);
}

async function fetchFilesInternal(
  repoSource: RepoSource,
): Promise<FetchResult> {
  const { owner, repo, sha, installationId } = repoSource;
  const maxFileSize = REPOSITORY_EVIDENCE_MAX_FILE_BYTES;

  logInfo(
    { owner, repo, sha, installationId, maxFileSize },
    "Fetching GitHub repository files",
  );

  const octokit = new Octokit({
    auth: await getInstallationToken(installationId),
  });

  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: sha,
    recursive: "true",
  });

  const blobPaths = tree.tree
    .filter((item) => item.type === "blob" && item.path)
    .map((item) => item.path!);

  const selection = selectRepositoryEvidenceCandidatePaths(blobPaths);
  const pathToItem = new Map(
    tree.tree
      .filter((item) => item.type === "blob" && item.path)
      .map((item) => [item.path!, item]),
  );

  const sourceFiles = selection.selectedPaths
    .map((path) => {
      const item = pathToItem.get(path);
      if (item) return item;
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  let sourceFilesSkippedFetchError =
    selection.selectedCandidateCount - sourceFiles.length;

  logInfo(
    {
      eligibleCandidateCount: selection.eligibleCandidateCount,
      selectedCandidateCount: selection.selectedCandidateCount,
      capTruncatedCandidateCount: selection.capTruncatedCandidateCount,
      treeMatchedForFetch: sourceFiles.length,
    },
    "Found and filtered source files",
  );

  const fileContents = new Map<string, string>();
  let sourceFilesSkippedOversized = 0;

  for (let i = 0; i < sourceFiles.length; i += BATCH_SIZE) {
    const batch = sourceFiles.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (file) => {
        try {
          const { data } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: file.sha!,
          });

          if (data.size && data.size > maxFileSize) {
            sourceFilesSkippedOversized++;
            return null;
          }

          const content = Buffer.from(data.content, "base64").toString("utf-8");
          if (Buffer.byteLength(content, "utf-8") > maxFileSize) {
            sourceFilesSkippedOversized++;
            return null;
          }

          return { path: file.path!, content };
        } catch (error: unknown) {
          logWarn(
            {
              error: error instanceof Error ? error.message : String(error),
              path: file.path,
            },
            "Failed to fetch file",
          );
          sourceFilesSkippedFetchError++;
          return null;
        }
      }),
    );

    for (const result of results) {
      if (result) fileContents.set(result.path, result.content);
    }
  }

  const accounting: RepositoryEvidenceAcquisitionAccounting = {
    repositoryEvidenceEligibleCandidateCount: selection.eligibleCandidateCount,
    repositoryEvidenceSelectedCandidateCount: selection.selectedCandidateCount,
    repositoryEvidenceCapTruncatedCandidateCount:
      selection.capTruncatedCandidateCount,
    sourceFilesSkippedOversized,
    sourceFilesSkippedFetchError,
  };

  const sourceFilesSkipped = aggregateSourceFilesSkipped(accounting);

  logInfo(
    {
      count: fileContents.size,
      sourceFilesSkipped,
      sourceFilesSkippedOversized,
      sourceFilesSkippedFetchError,
      repositoryEvidenceCapTruncatedCandidateCount:
        selection.capTruncatedCandidateCount,
    },
    "Successfully fetched file contents",
  );

  return {
    files: fileContents,
    sourceFilesSkipped,
    ...accounting,
  };
}

export function classifyFetchError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("timeout") || message.includes("timed out"))
    return "timeout";
  if (message.includes("rate limit") || message.includes("429"))
    return "rate_limit";
  if (
    message.includes("authentication") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("GitHub App credentials")
  ) {
    return "auth_failure";
  }
  if (message.includes("not found") || message.includes("404"))
    return "not_found";
  return "unknown";
}
