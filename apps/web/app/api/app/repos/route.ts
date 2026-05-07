import { NextResponse } from "next/server";
import { auth } from "../../../../auth";

export type Repo = {
  name: string;
  fullName: string;
  private: boolean;
  updatedAt: string;
};

export type ReposResponse = {
  repos: Repo[];
};

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const org = searchParams.get("org")?.trim() ?? "";

  if (!org) {
    return NextResponse.json(
      { error: "org query parameter is required" },
      { status: 400 },
    );
  }

  // Explicit branching — do not rely on a single endpoint for both cases:
  // - Personal: GET /user/repos (authenticated user's own repos, includes private)
  // - Org: GET /orgs/:org/repos (repos the user can see within the org)
  // GET /users/:login/repos is intentionally NOT used — returns only public repos.
  const isPersonal = org === session.githubLogin;
  const githubUrl = isPersonal
    ? "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner"
    : `https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=100&sort=updated`;

  const ghRes = await fetch(githubUrl, {
    headers: {
      ...GITHUB_HEADERS,
      Authorization: `Bearer ${session.accessToken}`,
    },
    cache: "no-store",
  });

  if (ghRes.status === 401) {
    return NextResponse.json(
      { error: "GitHub token expired" },
      { status: 401 },
    );
  }

  if (!ghRes.ok) {
    return NextResponse.json(
      { error: `GitHub API error: ${ghRes.status}` },
      { status: ghRes.status },
    );
  }

  const raw = (await ghRes.json()) as Array<{
    name: string;
    full_name: string;
    private: boolean;
    updated_at: string;
  }>;

  const repos: Repo[] = raw.map((r) => ({
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({ repos } satisfies ReposResponse);
}
