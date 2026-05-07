import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * Session encryption/signing secret. Required in production — set `AUTH_SECRET`
 * (e.g. `openssl rand -base64 32`). In development only, a fixed placeholder is
 * used when unset so `next dev` works without `.env.local`; never rely on this in prod.
 */
function resolveAuthSecret(): string | undefined {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    return "local-dev-auth-secret-not-for-production";
  }
  return undefined;
}

async function fetchGithubOrgs(accessToken: string): Promise<string[]> {
  const res = await fetch("https://api.github.com/user/orgs?per_page=100", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ login: string }>;
  return data.map((o) => o.login);
}

/**
 * Upsert the authenticated user into the DB via the internal Fastify endpoint.
 * Returns the DB UUID or null if the call fails (non-fatal — user can still log in).
 * Uses raw fetch to avoid importing server-only modules that would break
 * the Edge runtime used by the auth middleware.
 */
async function upsertUser(profile: {
  githubId: number;
  githubLogin: string;
  name?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}): Promise<string | null> {
  try {
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
    const apiKey =
      process.env.MERGESIGNAL_API_KEY ??
      (process.env.NODE_ENV !== "production"
        ? process.env.MERGESIGNAL_DEV_API_KEY
        : undefined);

    if (!apiKey) return null;

    const res = await fetch(`${apiBase}/internal/users/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        githubId: profile.githubId,
        githubLogin: profile.githubLogin,
        name: profile.name ?? null,
        avatarUrl: profile.avatarUrl ?? null,
        email: profile.email ?? null,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { id: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: resolveAuthSecret(),
  trustHost: true,
  session: {
    // Bound session lifetime to limit githubOrgs staleness and force periodic re-auth
    maxAge: 24 * 60 * 60, // 24 hours
  },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID ?? process.env.GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? process.env.GITHUB_SECRET,
      authorization: {
        params: { scope: "read:user user:email read:org" },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token && profile) {
        // First sign-in: account and profile are only present on initial OAuth callback
        const p = profile as {
          id?: number;
          login?: string;
          name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
        };

        if (typeof p.login === "string") {
          token.githubLogin = p.login;
        }
        token.accessToken = account.access_token;
        token.githubOrgs = await fetchGithubOrgs(account.access_token);

        // Persist user in DB; store UUID for use as cache key in repo-guard
        if (typeof p.id === "number" && typeof p.login === "string") {
          const userId = await upsertUser({
            githubId: p.id,
            githubLogin: p.login,
            name: p.name,
            avatarUrl: p.avatar_url,
            email: p.email,
          });
          if (userId) token.userId = userId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.githubLogin === "string") {
        session.githubLogin = token.githubLogin;
      }
      if (typeof token.accessToken === "string") {
        session.accessToken = token.accessToken;
      }
      if (Array.isArray(token.githubOrgs)) {
        session.githubOrgs = token.githubOrgs as string[];
      } else {
        session.githubOrgs = [];
      }
      if (typeof token.userId === "string") {
        session.userId = token.userId;
      }
      return session;
    },
  },
});
