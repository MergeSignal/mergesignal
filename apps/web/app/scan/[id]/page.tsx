import { Suspense } from "react";
import ScanClient from "./ScanClient";
import { SiteChrome } from "../../components/shared/layout/SiteChrome/SiteChrome";
import { ApiError, serverApiGet } from "../../../lib/api";
import { fetchPullRequestTitle } from "../../../lib/github-open-pull-requests";
import { requireRepoAccess } from "../../../lib/repo-guard";
import { auth } from "../../../auth";

type ApiScan = {
  id: string;
  repoId: string;
  repo_id?: string;
  status: "queued" | "running" | "done" | "failed";
  detailPresentation?: unknown;
  error?: string | null;
  methodologyVersion?: string | null;
  methodology_version?: string | null;
  githubPrNumber?: number | null;
  github_pr_number?: number | null;
  githubHeadSha?: string | null;
  github_head_sha?: string | null;
  githubBaseRef?: string | null;
  github_base_ref?: string | null;
};

function parseRepoId(repoId: string): { owner: string; repo: string } {
  const [owner = "", repo = ""] = repoId.split("/", 2);
  return { owner, repo };
}

async function resolvePageTitle(scan: ApiScan): Promise<string> {
  const prNumber = scan.githubPrNumber ?? scan.github_pr_number;
  if (prNumber == null) return "Scan";

  const repoId = scan.repoId ?? scan.repo_id ?? "";
  const { owner, repo } = parseRepoId(repoId);
  if (!owner || !repo) return `Pull request #${prNumber}`;

  const session = await auth();
  const accessToken = session?.accessToken ?? null;
  if (accessToken) {
    const pr = await fetchPullRequestTitle(
      accessToken,
      owner,
      repo,
      scan.github_pr_number ?? prNumber,
    );
    if (pr.kind === "success") {
      return `${pr.title} #${prNumber}`;
    }
  }

  return `Pull request #${prNumber}`;
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let scan: ApiScan;
  try {
    scan = await serverApiGet<ApiScan>(`/scan/${encodeURIComponent(id)}`);
  } catch (err: unknown) {
    const errorText =
      err instanceof ApiError ? (err.body ?? err.message) : String(err);
    return (
      <SiteChrome title="Scan" subtitle={id}>
        <pre style={{ whiteSpace: "pre-wrap" }}>{errorText}</pre>
      </SiteChrome>
    );
  }

  const { owner, repo } = parseRepoId(scan.repoId ?? scan.repo_id ?? "");
  await requireRepoAccess(owner, repo, {
    redirectTo: "/scan/" + encodeURIComponent(id),
  });

  const allowDebug = process.env.MS_ALLOW_SCAN_DEBUG === "1";
  const title = await resolvePageTitle(scan);

  return (
    <SiteChrome title={title} owner={owner}>
      <Suspense fallback={null}>
        <ScanClient
          id={id}
          allowDebug={allowDebug}
          initialRow={{
            id: scan.id,
            status: scan.status,
            detailPresentation: scan.detailPresentation as never,
            error: scan.error ?? null,
            methodologyVersion:
              scan.methodologyVersion ?? scan.methodology_version ?? null,
            repoId: scan.repoId ?? scan.repo_id,
            githubPrNumber:
              scan.githubPrNumber ?? scan.github_pr_number ?? null,
            githubHeadSha: scan.githubHeadSha ?? scan.github_head_sha ?? null,
          }}
        />
      </Suspense>
    </SiteChrome>
  );
}
