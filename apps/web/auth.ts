import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
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
      if (
        profile &&
        typeof (profile as { login?: string }).login === "string"
      ) {
        token.githubLogin = (profile as { login: string }).login;
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.githubOrgs = await fetchGithubOrgs(account.access_token);
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
      return session;
    },
  },
});
