import { auth } from "../../../../auth";
import { isDevAuthBypass } from "../../../../lib/dev-auth";
import { checkRepoAccessForSession } from "../../../../lib/repo-guard";
import { serverApiFetch } from "../../../../lib/server-api";

function parseRepoId(repoId: string): { owner: string; repo: string } {
  const [owner = "", repo = ""] = repoId.split("/", 2);
  return { owner, repo };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const include = new URL(req.url).searchParams.get("include");
  const query = include ? `?include=${encodeURIComponent(include)}` : "";

  if (isDevAuthBypass()) {
    const upstream = await serverApiFetch(
      `/scan/${encodeURIComponent(id)}${query}`,
    );
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const scanRes = await serverApiFetch(`/scan/${encodeURIComponent(id)}`);
  if (!scanRes.ok) {
    return new Response(await scanRes.text(), { status: scanRes.status });
  }

  const scan = (await scanRes.json()) as { repoId?: string; repo_id?: string };
  const repoId = scan.repoId ?? scan.repo_id ?? "";
  const { owner, repo } = parseRepoId(repoId);
  if (!owner || !repo) {
    return new Response("Invalid scan repo", { status: 400 });
  }

  const access = await checkRepoAccessForSession(session, owner, repo);
  if (access === "reauth") {
    return new Response("Unauthorized", { status: 401 });
  }
  if (access === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const upstream = await serverApiFetch(
    `/scan/${encodeURIComponent(id)}${query}`,
  );
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
