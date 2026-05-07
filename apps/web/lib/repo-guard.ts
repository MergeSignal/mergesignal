import "server-only";

import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "../auth";

// ---------------------------------------------------------------------------
// Process-level TTL cache for positive repo access checks.
//
// Design notes:
//  - Only successful access checks (HTTP 200) are cached.
//  - 401 and 403/404 results are never cached.
//  - Cache key: userId + owner + repo (userId is the DB UUID from the users
//    table, falling back to githubLogin for sessions predating the column).
//  - Each pod in a k8s deployment has its own independent cache — this is a
//    conscious decision: cross-pod cache misses cause extra GitHub API calls,
//    never incorrect authorization. Correctness is guaranteed by GitHub's API
//    being the authoritative source.
//  - Max 1000 entries enforced by evicting the oldest on overflow.
//  - No extra npm dependency (Map + manual TTL, no lru-cache).
// ---------------------------------------------------------------------------

const TTL_MS = 60_000; // 60 seconds
const MAX_ENTRIES = 1000;

const processCache = new Map<string, { expiresAt: number }>();

function evictIfNeeded(): void {
  if (processCache.size < MAX_ENTRIES) return;
  // Remove the first (oldest) inserted entry
  const firstKey = processCache.keys().next().value;
  if (firstKey !== undefined) processCache.delete(firstKey);
}

type AccessResult = "ok" | "reauth" | "forbidden";

/**
 * Inner check wrapped with React cache() for per-request memoization.
 * If requireRepoAccess is called multiple times within the same server render
 * (e.g. layout + page) the GitHub check runs only once per request.
 */
const _checkGitHubAccess = cache(
  async (
    userId: string,
    owner: string,
    repo: string,
    accessToken: string,
  ): Promise<AccessResult> => {
    const key = `${userId}:${owner}:${repo}`;
    const now = Date.now();

    const entry = processCache.get(key);
    if (entry && entry.expiresAt > now) return "ok";

    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        // No caching at the HTTP layer — we manage our own TTL
        cache: "no-store",
      },
    );

    if (res.status === 200) {
      evictIfNeeded();
      processCache.set(key, { expiresAt: now + TTL_MS });
      return "ok";
    }

    // 401: token expired — not cached, may succeed after re-auth
    if (res.status === 401) return "reauth";

    // 403 or 404: access denied — not cached, may be granted later
    return "forbidden";
  },
);

/**
 * Assert that the authenticated user has read access to owner/repo via GitHub.
 *
 * - On success: returns void (caller proceeds normally).
 * - On missing session / expired token: redirects to GitHub OAuth.
 * - On 403/404 from GitHub: calls notFound() (renders not-found page).
 *
 * Does NOT check MERGESIGNAL_LINKED_GITHUB_OWNER — that check applies to the
 * single-tenant /org/* routes only. This guard is for the multi-tenant /app/*.
 */
export async function requireRepoAccess(
  owner: string,
  repo: string,
): Promise<void> {
  const callbackUrl = `/app/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const signInUrl = `/api/auth/signin/github?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const session = await auth();

  if (!session) {
    redirect(signInUrl);
  }

  const accessToken = session.accessToken;
  if (!accessToken) {
    redirect(signInUrl);
  }

  // Fall back to githubLogin for sessions created before userId was added
  const userId = session.userId ?? session.githubLogin ?? "unknown";

  const result = await _checkGitHubAccess(userId, owner, repo, accessToken);

  if (result === "reauth") {
    redirect(signInUrl);
  }
  if (result === "forbidden") {
    notFound();
  }
}
