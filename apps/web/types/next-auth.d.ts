import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    githubLogin?: string;
    accessToken?: string;
    githubOrgs: string[];
    user: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    githubLogin?: string;
    accessToken?: string;
    githubOrgs?: string[];
  }
}
