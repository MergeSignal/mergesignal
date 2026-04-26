import { auth } from "../../../../../auth";
import {
  getLinkedOwnerMismatch,
  repoOwnerFromRepoId,
  userCanAccessGithubOwner,
} from "../../../../../lib/access";
import { isDevAuthBypass } from "../../../../../lib/dev-auth";
import { serverApiFetch } from "../../../../../lib/server-api";

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
  const owner = repoOwnerFromRepoId(scan.repo_id);

  const linkedErr = getLinkedOwnerMismatch(owner);
  if (linkedErr) {
    return new Response(linkedErr.message, { status: linkedErr.status });
  }

  if (!userCanAccessGithubOwner(session, owner)) {
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
