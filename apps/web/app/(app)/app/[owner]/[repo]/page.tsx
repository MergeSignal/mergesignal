import { notFound } from "next/navigation";
import { requireRepoAccess } from "../../../../../lib/repo-guard";
import { serverApiGet, ApiError } from "../../../../../lib/api";
import { RepoOverview } from "../../../../components/app/RepoOverview/RepoOverview";
import { ShellTitlebar } from "../../../../components/shared/layout/SiteChrome/ShellTitlebar";

type OverviewData = {
  repoId: string;
  latestScan: {
    id: string;
    status: string;
    totalScore: number | null;
    layerSecurity: number | null;
    layerMaintainability: number | null;
    layerEcosystem: number | null;
    layerUpgradeImpact: number | null;
    createdAt: string;
    decision: string | null;
  } | null;
  alertCounts: { high: number; medium: number; low: number };
};

export default async function RepoOverviewPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  // Enforce authorization: verifies user has GitHub read access to this repo.
  // Redirects to re-auth on token expiry; calls notFound() on 403/404.
  await requireRepoAccess(owner, repo);

  let data: OverviewData | null = null;
  let fetchError: string | null = null;

  try {
    data = await serverApiGet<OverviewData>(
      `/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/overview`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    fetchError =
      err instanceof ApiError
        ? err.message
        : "An unexpected error occurred loading this repository.";
  }

  return (
    <>
      <ShellTitlebar title={repo} subtitle={owner} />
      {fetchError || !data ? (
        <div style={{ padding: "2rem" }}>
          <p style={{ color: "var(--color-danger, #c0392b)", fontWeight: 600 }}>
            Failed to load repository data
          </p>
          <p
            style={{
              color: "var(--color-text-muted, #666)",
              marginTop: "0.5rem",
            }}
          >
            {fetchError ?? "No data returned."}
          </p>
        </div>
      ) : (
        <RepoOverview
          repoId={data.repoId}
          latestScan={data.latestScan}
          alertCounts={data.alertCounts}
        />
      )}
    </>
  );
}
