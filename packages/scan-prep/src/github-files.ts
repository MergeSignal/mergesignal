import type { RepoSource } from "@mergesignal/shared";
import { Octokit } from "octokit";

import { getInstallationToken } from "./github-auth.js";
import { logInfo, logWarn } from "./log.js";
import {
  REPOSITORY_EVIDENCE_DEFAULT_GLOB_PATTERNS,
  REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES,
  REPOSITORY_EVIDENCE_MAX_FILE_BYTES,
  prioritizeRepositoryEvidencePaths,
} from "./repository-evidence/corpusPolicy.js";

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const BATCH_SIZE = 10;

export interface FetchOptions {
  timeoutMs?: number;
  maxFileSize?: number;
  maxFiles?: number;
  patterns?: string[];
}

export interface FetchResult {
  files: Map<string, string>;
  sourceFilesSkipped: number;
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
  const maxFileSize = options.maxFileSize ?? REPOSITORY_EVIDENCE_MAX_FILE_BYTES;
  const maxFiles = options.maxFiles ?? REPOSITORY_EVIDENCE_MAX_CANDIDATE_FILES;
  const patterns = options.patterns ?? [
    ...REPOSITORY_EVIDENCE_DEFAULT_GLOB_PATTERNS,
  ];

  return Promise.race([
    fetchFilesInternal(repoSource, patterns, { maxFileSize, maxFiles }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("File fetch timeout")), timeoutMs),
    ),
  ]);
}

async function fetchFilesInternal(
  repoSource: RepoSource,
  patterns: string[],
  options: { maxFileSize: number; maxFiles: number },
): Promise<FetchResult> {
  const { owner, repo, sha, installationId } = repoSource;
  const { maxFileSize, maxFiles } = options;

  logInfo(
    { owner, repo, sha, installationId, maxFileSize, maxFiles },
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

  const selectedPaths = prioritizeRepositoryEvidencePaths(blobPaths, {
    maxFiles,
    patterns,
  });
  const pathToItem = new Map(
    tree.tree
      .filter((item) => item.type === "blob" && item.path)
      .map((item) => [item.path!, item]),
  );
  const sourceFiles = selectedPaths
    .map((path) => pathToItem.get(path))
    .filter((item): item is NonNullable<typeof item> => item != null);

  const candidatesAfterFilter = sourceFiles.length;

  logInfo(
    { count: sourceFiles.length, maxFiles },
    "Found and filtered source files",
  );

  const fileContents = new Map<string, string>();
  let skippedLargeFiles = 0;
  let skippedErrors = 0;

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
            skippedLargeFiles++;
            return null;
          }

          const content = Buffer.from(data.content, "base64").toString("utf-8");
          if (Buffer.byteLength(content, "utf-8") > maxFileSize) {
            skippedLargeFiles++;
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
          skippedErrors++;
          return null;
        }
      }),
    );

    for (const result of results) {
      if (result) fileContents.set(result.path, result.content);
    }
  }

  const sourceFilesSkipped =
    skippedLargeFiles +
    skippedErrors +
    Math.max(0, candidatesAfterFilter - fileContents.size);

  logInfo(
    {
      count: fileContents.size,
      skippedLargeFiles,
      skippedErrors,
      sourceFilesSkipped,
    },
    "Successfully fetched file contents",
  );

  return { files: fileContents, sourceFilesSkipped };
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
