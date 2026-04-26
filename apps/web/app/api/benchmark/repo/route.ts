import { auth } from "../../../../auth";
import {
  getLinkedOwnerMismatch,
  repoOwnerFromRepoId,
  userCanAccessGithubOwner,
} from "../../../../lib/access";
import { isDevAuthBypass } from "../../../../lib/dev-auth";
import { serverApiFetch } from "../../../../lib/server-api";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const repoId = url.searchParams.get("repoId")?.trim();
  if (!repoId) {
    return new Response("repoId is required", { status: 400 });
  }

  if (!isDevAuthBypass()) {
    const session = await auth();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const owner = repoOwnerFromRepoId(repoId);
    const linkedErr = getLinkedOwnerMismatch(owner);
    if (linkedErr) {
      return new Response(linkedErr.message, { status: linkedErr.status });
    }
    if (!userCanAccessGithubOwner(session, owner)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const upstream = await serverApiFetch(
    `/benchmark/repo?repoId=${encodeURIComponent(repoId)}`,
  );
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}
