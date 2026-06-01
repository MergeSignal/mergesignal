import "server-only";

/** Minimal GitHub REST shape for an open PR list item. */
export type GithubOpenPR = {
  number: number;
  title: string;
  baseRef: string;
  headSha: string;
  updatedAt: string;
  htmlUrl: string;
};

type GithubPRRaw = {
  number: number;
  title: string;
  base: { ref: string };
  head: { sha: string };
  updated_at: string;
  html_url: string;
};

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

type FetchPRsResult =
  | { kind: "success"; prs: GithubOpenPR[]; hasMore: boolean }
  | { kind: "unauthorized" }
  | { kind: "error"; status: number };

/**
 * Fetch the first page of open pull requests for owner/repo using the
 * provided GitHub OAuth access token. Returns at most `perPage` PRs (default
 * 30) ordered by last update descending — the same order as GitHub's default.
 *
 * On token expiry (HTTP 401), returns `{ kind: "unauthorized" }` so the
 * caller can redirect to re-auth without crashing the page render.
 */
export async function fetchOpenPullRequestsForRepo(
  accessToken: string,
  owner: string,
  repo: string,
  perPage = 30,
): Promise<FetchPRsResult> {
  const url =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls` +
    `?state=open&sort=updated&direction=desc&per_page=${perPage}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        ...GITHUB_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
  } catch {
    return { kind: "error", status: 503 };
  }

  if (res.status === 401) return { kind: "unauthorized" };
  if (!res.ok) return { kind: "error", status: res.status };

  const raw = (await res.json()) as GithubPRRaw[];

  // Detect whether there might be more results via Link header
  const linkHeader = res.headers.get("link") ?? "";
  const hasMore = linkHeader.includes('rel="next"');

  const prs: GithubOpenPR[] = raw.map((pr) => ({
    number: pr.number,
    title: pr.title,
    baseRef: pr.base.ref,
    headSha: pr.head.sha,
    updatedAt: pr.updated_at,
    htmlUrl: pr.html_url,
  }));

  return { kind: "success", prs, hasMore };
}

type FetchPRTitleResult =
  | { kind: "success"; title: string }
  | { kind: "not_found" }
  | { kind: "unauthorized" }
  | { kind: "error"; status: number };

/** Fetch a single PR title by number (open or closed). */
export async function fetchPullRequestTitle(
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<FetchPRTitleResult> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        ...GITHUB_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
  } catch {
    return { kind: "error", status: 503 };
  }

  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status === 404) return { kind: "not_found" };
  if (!res.ok) return { kind: "error", status: res.status };

  const raw = (await res.json()) as { title?: string };
  const title = String(raw.title ?? "").trim();
  if (!title) return { kind: "not_found" };
  return { kind: "success", title };
}
