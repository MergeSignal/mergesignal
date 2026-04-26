import ScanClient from "./ScanClient";
import { AppShell } from "../../_components/AppShell";
import { repoOwnerFromRepoId } from "../../../lib/access";
import { ApiError, serverApiGet } from "../../../lib/api";
import { requireOrgAccess } from "../../../lib/org-guard";

type ApiScan = {
  id: string;
  repo_id: string;
  status: "queued" | "running" | "done" | "failed";
  result?: unknown;
  error?: string | null;
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
      <AppShell title="Scan" subtitle={id}>
        <pre style={{ whiteSpace: "pre-wrap" }}>{errorText}</pre>
      </AppShell>
    );
  }

  const owner = repoOwnerFromRepoId(scan.repo_id);
  await requireOrgAccess(owner);

  return (
    <AppShell title="Scan" subtitle={scan.repo_id} owner={owner}>
      <ScanClient
        id={id}
        initialRow={{
          id: scan.id,
          status: scan.status,
          result: scan.result as never,
          error: scan.error ?? null,
        }}
      />
    </AppShell>
  );
}
