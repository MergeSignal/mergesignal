import { MSCard } from "../../../../components/shared/MSCard/MSCard";
import {
  MSDataTable,
  MSTD,
} from "../../../../components/shared/MSTable/MSTable";
import { ShellTitlebar } from "../../../../components/shared/layout/SiteChrome/ShellTitlebar";
import typo from "../../../../_styles/typography.module.css";
import { ApiError, serverApiGet } from "../../../../../lib/api";
import { getPublicApiBaseUrl } from "../../../../../lib/env";
import { requireOrgAccess } from "../../../../../lib/org-guard";

type PoliciesResponse = {
  owner: string;
  policies: Array<{
    id: string;
    owner: string;
    name: string;
    enabled: boolean;
    rules: unknown;
    created_at: string;
    updated_at: string;
  }>;
};

type ViolationsResponse = {
  owner: string;
  repoId: string | null;
  violations: Array<{
    id: string;
    policy_id: string;
    owner: string;
    repo_id: string;
    severity: string;
    title: string;
    details: unknown;
    created_at: string;
  }>;
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string }>;
  searchParams?: Promise<{ limit?: string }>;
}) {
  const { owner } = await params;
  await requireOrgAccess(owner);
  const sp = (await searchParams) ?? {};
  const limit = sp.limit ? Number(sp.limit) : 100;

  const baseUrl = getPublicApiBaseUrl();

  let policies: PoliciesResponse;
  let violations: ViolationsResponse;
  try {
    [policies, violations] = await Promise.all([
      serverApiGet<PoliciesResponse>(
        `/org/${encodeURIComponent(owner)}/policies`,
      ),
      serverApiGet<ViolationsResponse>(
        `/org/${encodeURIComponent(owner)}/policy/violations?limit=${limit}`,
      ),
    ]);
  } catch (err: unknown) {
    const errorText =
      err instanceof ApiError ? (err.body ?? err.message) : String(err);
    return (
      <>
        <ShellTitlebar title="Policies" subtitle={owner} />
        <pre style={{ whiteSpace: "pre-wrap" }}>{errorText}</pre>
      </>
    );
  }

  return (
    <>
      <ShellTitlebar
        title="Policies"
        subtitle={`policies: ${policies.policies.length} • recent violations: ${violations.violations.length}`}
      />
      <h2 className={typo.h2Tight}>Policies</h2>
      {policies.policies.length === 0 ? (
        <MSCard title="No policies yet" subtitle="Create one via API:">
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {`curl -X POST "${baseUrl}/org/${owner}/policies" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"baseline","enabled":true,"rules":[{"type":"no_deprecated"},{"type":"max_stale_releases_count","max":3}]}'`}
          </pre>
        </MSCard>
      ) : (
        <ul>
          {policies.policies.map((p) => (
            <li key={p.id}>
              <b>{p.name}</b> ({p.enabled ? "enabled" : "disabled"}){" "}
              <code>{p.id}</code>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(p.rules, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}

      <h2 className={typo.h2}>Recent violations</h2>
      <MSDataTable
        headers={["Time", "Repo", "Severity", "Title", "Policy"]}
        minWidth={900}
        rows={violations.violations.map((v) => (
          <tr key={v.id}>
            <MSTD>{new Date(v.created_at).toLocaleString()}</MSTD>
            <MSTD>
              <code>{v.repo_id}</code>
            </MSTD>
            <MSTD>{v.severity}</MSTD>
            <MSTD>{v.title}</MSTD>
            <MSTD>
              <code>{v.policy_id}</code>
            </MSTD>
          </tr>
        ))}
      />

      {violations.violations.length > 0 && (
        <>
          <h2 className={typo.h2}>Latest violation details</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(violations.violations[0]?.details ?? null, null, 2)}
          </pre>
        </>
      )}
    </>
  );
}
