import ScanClient from "./ScanClient";
import { SiteChrome } from "../../components/shared/layout/SiteChrome/SiteChrome";
import { repoOwnerFromRepoId } from "../../../lib/access";
import { ApiError, serverApiGet } from "../../../lib/api";
import { requireOrgAccess } from "../../../lib/org-guard";

type ApiScan = {
  id: string;
  repo_id: string;
  status: "queued" | "running" | "done" | "failed";
  result?: unknown;
  error?: string | null;
  methodology_version?: string | null;
};

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

  const owner = repoOwnerFromRepoId(scan.repo_id);
  await requireOrgAccess(owner, {
    redirectTo: "/scan/" + encodeURIComponent(id),
  });

  return (
    <SiteChrome title="Scan" subtitle={scan.repo_id} owner={owner}>
      <ScanClient
        id={id}
        initialRow={{
          id: scan.id,
          status: scan.status,
          result: scan.result as never,
          error: scan.error ?? null,
          methodologyVersion: scan.methodology_version ?? null,
        }}
      />
    </SiteChrome>
  );
}
