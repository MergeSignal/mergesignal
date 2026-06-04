import type { RepoSource } from "@mergesignal/shared";
import { Octokit } from "octokit";

import { getInstallationToken } from "./github-auth.js";
import { logInfo, logWarn } from "./log.js";

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE_BYTES = 500_000;
const MAX_TOTAL_FILES = 1000;
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
  const maxFileSize = options.maxFileSize ?? MAX_FILE_SIZE_BYTES;
  const maxFiles = options.maxFiles ?? MAX_TOTAL_FILES;
  const patterns = options.patterns ?? [
    "*.ts",
    "*.tsx",
    "*.js",
    "*.jsx",
    "*.mjs",
    "*.cjs",
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

  const sourceFiles = filterAndPrioritizeFiles(tree.tree, patterns, maxFiles);
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

function filterAndPrioritizeFiles(
  treeItems: Array<{ type?: string; path?: string; sha?: string }>,
  patterns: string[],
  maxFiles: number,
): Array<{ type?: string; path?: string; sha?: string }> {
  const sourceFiles = treeItems.filter((item) => {
    if (item.type !== "blob" || !item.path) return false;

    const skipPaths = [
      "node_modules/",
      ".next/",
      "dist/",
      "build/",
      ".git/",
      "coverage/",
      ".turbo/",
      ".cache/",
      "public/",
      "static/",
      "assets/",
      "__tests__/",
      "__mocks__/",
      "test/",
      "tests/",
      "spec/",
      "specs/",
    ];

    if (skipPaths.some((skip) => item.path!.includes(skip))) return false;

    return patterns.some((pattern) => {
      const regex = new RegExp(
        pattern.replace(/\*/g, ".*").replace(/\./g, "\\."),
      );
      return regex.test(item.path!);
    });
  });

  return sourceFiles
    .sort((a, b) => getFilePriority(b.path!) - getFilePriority(a.path!))
    .slice(0, maxFiles);
}

function getFilePriority(path: string): number {
  let score = 0;
  const entryPoints = [
    "index.ts",
    "index.tsx",
    "index.js",
    "main.ts",
    "server.ts",
    "app.ts",
  ];
  if (entryPoints.some((e) => path.endsWith(e))) score += 100;

  const criticalPaths = [
    "auth/",
    "authentication/",
    "api/",
    "core/",
    "db/",
    "payment/",
    "checkout/",
  ];
  if (criticalPaths.some((c) => path.includes(c))) score += 50;

  const sourceDirs = ["src/", "lib/", "app/", "pages/", "components/"];
  if (sourceDirs.some((d) => path.includes(d))) score += 25;

  if (path.endsWith(".ts") || path.endsWith(".tsx")) score += 10;
  score -= path.split("/").length;
  return score;
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
