import type { App } from "@octokit/app";

export type FetchFileOptions = {
  owner: string;
  repo: string;
  path: string;
  ref: string;
};

export async function fetchFileContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  octokit: any,
  opts: FetchFileOptions,
): Promise<string | null> {
  try {
    const contents = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: opts.owner,
      repo: opts.repo,
      path: opts.path,
      ref: opts.ref,
    });

    const b64 = (contents.data as Record<string, unknown>)?.content;
    if (!b64 || typeof b64 !== "string") return null;
    return Buffer.from(b64, "base64").toString("utf8");
  } catch (e: unknown) {
    const errObj = e as { status?: number; response?: { status?: number } };
    const status = Number(errObj?.status ?? errObj?.response?.status ?? 0);
    if (status === 404) return null;
    throw e;
  }
}

export async function fetchMultipleFiles(
  app: App,
  installationId: number,
  opts: { owner: string; repo: string; ref: string; paths: string[] },
): Promise<Map<string, string>> {
  const octokit = await app.getInstallationOctokit(installationId);
  const results = new Map<string, string>();

  for (const path of opts.paths) {
    const content = await fetchFileContent(octokit, {
      owner: opts.owner,
      repo: opts.repo,
      path,
      ref: opts.ref,
    });
    if (content !== null) {
      results.set(path, content);
    }
  }

  return results;
}

export function filterRelevantSourceFiles(changedFiles: string[]): string[] {
  const SOURCE_EXTENSIONS = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
  ]);

  const IGNORED_PATTERNS = [
    /node_modules\//,
    /\.test\./,
    /\.spec\./,
    /\/__tests__\//,
    /^test\//,
    /^tests\//,
    /\/test\//,
    /\/tests\//,
    /\.d\.ts$/,
  ];

  return changedFiles.filter((file) => {
    const ext = file.substring(file.lastIndexOf("."));
    if (!SOURCE_EXTENSIONS.has(ext)) return false;

    for (const pattern of IGNORED_PATTERNS) {
      if (pattern.test(file)) return false;
    }

    return true;
  });
}
