import Link from "next/link";

type OrgAlerts = {
  owner: string;
  alerts: Array<{
    id: string;
    repo_id: string;
    type: string;
    severity: string;
    title: string;
    details: any;
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
  const sp = (await searchParams) ?? {};
  const limit = sp.limit ? Number(sp.limit) : 100;

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const res = await fetch(
    `${baseUrl}/org/${encodeURIComponent(owner)}/alerts?limit=${limit}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    const text = await res.text();
    return (
      <div style={{ padding: 16 }}>
        <h1>Alerts: {owner}</h1>
        <pre>{text}</pre>
      </div>
    );
  }

  const data = (await res.json()) as OrgAlerts;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Alerts: {data.owner}</h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            total: <b>{data.alerts.length}</b>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignSelf: "center" }}>
          <Link href={`/org/${encodeURIComponent(owner)}`}>Dashboard</Link>
          <Link href="/">Home</Link>
        </div>
      </div>

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
          <thead>
            <tr>
              {["Time", "Repo", "Severity", "Title", "Type"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid #ddd",
                    padding: "10px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.alerts.map((a) => (
              <tr key={a.id}>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                  {new Date(a.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                  <code>{a.repo_id}</code>
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>{a.severity}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>{a.title}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                  <code>{a.type}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.alerts.length > 0 && (
        <>
          <h2 style={{ marginTop: 18 }}>Latest alert details</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(data.alerts[0]?.details ?? null, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}

