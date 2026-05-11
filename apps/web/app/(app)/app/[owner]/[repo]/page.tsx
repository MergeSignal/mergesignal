import { requireRepoAccess } from "../../../../../lib/repo-guard";
import { serverApiGet, ApiError } from "../../../../../lib/api";
import { auth } from "../../../../../auth";
import {
  fetchOpenPullRequestsForRepo,
  type GithubOpenPR,
} from "../../../../../lib/github-open-pull-requests";
import {
  buildRepoPullHealthViewModel,
  type PrScanIndexResponse,
} from "../../../../../lib/repo-health-view-model";
import { RepoHealthDashboard } from "../../../../components/app/RepoHealthDashboard/RepoHealthDashboard";
import { ShellTitlebar } from "../../../../components/shared/layout/SiteChrome/ShellTitlebar";

export const dynamic = "force-dynamic";

export default async function RepoOverviewPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  // Auth gate: redirects on token expiry, calls notFound() on 403/404
  await requireRepoAccess(owner, repo);

  const session = await auth();
  const accessToken = session?.accessToken ?? null;

  let prsFetchError: string | null = null;
  let scansFetchError: string | null = null;
  let prScanIndex: PrScanIndexResponse = {
    repoId: `${owner}/${repo}`,
    byPrNumber: {},
    aggregates: {
      totalCovered: 0,
      byDecision: { safe: 0, needs_review: 0, risky: 0 },
    },
  };

  const [prsResult, scansResult] = await Promise.all([
    accessToken
      ? fetchOpenPullRequestsForRepo(accessToken, owner, repo)
      : Promise.resolve({ kind: "error" as const, status: 401 }),
    serverApiGet<PrScanIndexResponse>(
      `/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pull-request-scans`,
    ).catch((err: unknown) => {
      // 404 → route not deployed yet or no data — treat as empty, not an error.
      // 5xx → real server failure worth surfacing in the UI.
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      const msg =
        err instanceof ApiError
          ? `Scan data temporarily unavailable (${err.status})`
          : "Could not reach scan service";
      return { error: msg };
    }),
  ]);

  let openPRs: GithubOpenPR[] = [];
  let hasMore = false;

  if (prsResult.kind === "success") {
    openPRs = prsResult.prs;
    hasMore = prsResult.hasMore;
  } else if (prsResult.kind === "unauthorized") {
    prsFetchError = "GitHub session expired. Please sign in again.";
  } else {
    prsFetchError = "Could not load pull requests from GitHub.";
  }

  if (scansResult !== null && "error" in scansResult) {
    scansFetchError = scansResult.error;
  } else if (scansResult !== null) {
    prScanIndex = scansResult;
  }
  // scansResult === null → 404 (route not yet deployed or no data) → silent empty state

  const viewModel = buildRepoPullHealthViewModel(openPRs, prScanIndex, hasMore);

  return (
    <>
      <ShellTitlebar title={repo} subtitle={owner} />
      <RepoHealthDashboard
        repoId={`${owner}/${repo}`}
        owner={owner}
        repo={repo}
        viewModel={viewModel}
        prsFetchError={prsFetchError}
        scansFetchError={scansFetchError}
      />
    </>
  );
}
