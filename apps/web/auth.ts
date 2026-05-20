import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { AuthLogEvent, logAuthEvent } from "./lib/auth";

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
      Authorization: "Bearer " + accessToken,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ login: string }>;
  return data.map((o) => o.login);
}

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

    const res = await fetch(apiBase + "/internal/users/upsert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
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
  debug: process.env.AUTH_DEBUG === "true",
  session: {
    maxAge: 24 * 60 * 60,
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
  events: {
    signIn: ({ user, account, profile }) => {
      const githubLogin =
        (profile as { login?: string } | null)?.login ??
        user?.name ??
        undefined;
      logAuthEvent(AuthLogEvent.SignInSuccess, {
        provider: account?.provider,
        githubLogin: typeof githubLogin === "string" ? githubLogin : undefined,
      });
    },
    signOut: (message) => {
      let githubLogin: string | undefined;
      if ("token" in message && message.token) {
        githubLogin =
          typeof message.token.githubLogin === "string"
            ? message.token.githubLogin
            : undefined;
      } else if ("session" in message && message.session) {
        const session = message.session as { githubLogin?: string };
        githubLogin =
          typeof session.githubLogin === "string"
            ? session.githubLogin
            : undefined;
      }
      logAuthEvent(AuthLogEvent.SignOut, { githubLogin });
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token && profile) {
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

        if (typeof p.id === "number" && typeof p.login === "string") {
          const userId = await upsertUser({
            githubId: p.id,
            githubLogin: p.login,
            name: p.name,
            avatarUrl: p.avatar_url,
            email: p.email,
          });
          if (userId) {
            token.userId = userId;
          } else {
            logAuthEvent(AuthLogEvent.JwtUpsertFailed, {
              githubLogin: p.login,
            });
          }
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
      } else if (typeof token.githubLogin === "string") {
        logAuthEvent(AuthLogEvent.SessionMissingClaims, {
          githubLogin: token.githubLogin,
        });
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
