import { AppShell } from "../../../_components/AppShell";
import { Card } from "../../../_components/ui/Card";
import { DataTable, TD } from "../../../_components/ui/Table";
import typo from "../../../_styles/typography.module.css";
import { ApiError, serverApiGet } from "../../../../lib/api";
import { getPublicApiBaseUrl } from "../../../../lib/env";
import { requireOrgAccess } from "../../../../lib/org-guard";

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
      <AppShell title="Policies" subtitle={owner} owner={owner}>
        <pre style={{ whiteSpace: "pre-wrap" }}>{errorText}</pre>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Policies"
      subtitle={`policies: ${policies.policies.length} • recent violations: ${violations.violations.length}`}
      owner={owner}
    >
      <h2 className={typo.h2Tight}>Policies</h2>
      {policies.policies.length === 0 ? (
        <Card title="No policies yet" subtitle="Create one via API:">
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {`curl -X POST "${baseUrl}/org/${owner}/policies" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"baseline","enabled":true,"rules":[{"type":"no_deprecated"},{"type":"max_stale_releases_count","max":3}]}'`}
          </pre>
        </Card>
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
      <DataTable
        headers={["Time", "Repo", "Severity", "Title", "Policy"]}
        minWidth={900}
        rows={violations.violations.map((v) => (
          <tr key={v.id}>
            <TD>{new Date(v.created_at).toLocaleString()}</TD>
            <TD>
              <code>{v.repo_id}</code>
            </TD>
            <TD>{v.severity}</TD>
            <TD>{v.title}</TD>
            <TD>
              <code>{v.policy_id}</code>
            </TD>
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
    </AppShell>
  );
}
