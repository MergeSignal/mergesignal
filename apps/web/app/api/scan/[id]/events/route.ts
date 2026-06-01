import { auth } from "../../../../../auth";
import { isDevAuthBypass } from "../../../../../lib/dev-auth";
import { checkRepoAccessForSession } from "../../../../../lib/repo-guard";
import { serverApiFetch } from "../../../../../lib/server-api";

function parseRepoId(repoId: string): { owner: string; repo: string } {
  const [owner = "", repo = ""] = repoId.split("/", 2);
  return { owner, repo };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (isDevAuthBypass()) {
    const upstream = await serverApiFetch(
      `/scan/${encodeURIComponent(id)}/events`,
    );
    if (!upstream.ok) {
      return new Response(await upstream.text(), { status: upstream.status });
    }
    const headers = new Headers();
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("Connection", "keep-alive");
    return new Response(upstream.body, { status: 200, headers });
  }

  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const scanRes = await serverApiFetch(`/scan/${encodeURIComponent(id)}`);
  if (!scanRes.ok) {
    return new Response(await scanRes.text(), { status: scanRes.status });
  }

  const scan = (await scanRes.json()) as { repo_id: string };
  const { owner, repo } = parseRepoId(scan.repo_id);
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
    `/scan/${encodeURIComponent(id)}/events`,
  );
  if (!upstream.ok) {
    return new Response(await upstream.text(), { status: upstream.status });
  }

  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream; charset=utf-8");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");

  return new Response(upstream.body, { status: 200, headers });
}
