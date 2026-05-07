import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    githubLogin?: string;
    accessToken?: string;
    githubOrgs: string[];
    /** DB UUID from the users table — used as cache key in repo-guard */
    userId?: string;
    user: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    githubLogin?: string;
    accessToken?: string;
    githubOrgs?: string[];
    userId?: string;
  }
}
