import Link from "next/link";

type Dashboard = {
  owner: string;
  summary: {
    repoCount: number;
    scoredRepoCount: number;
    avgScore: number | null;
    worst: Array<{ repoId: string; totalScore: number }>;
  };
  repos: Array<{
    repoId: string;
    latest: {
      scanId: string;
      status: string;
      totalScore: number | null;
      methodologyVersion: string | null;
      createdAt: string;
    };
    deltaTotalScore?: number | null;
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
  const limit = sp.limit ? Number(sp.limit) : 50;

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const res = await fetch(`${baseUrl}/org/${encodeURIComponent(owner)}/dashboard?limit=${limit}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return (
      <div style={{ padding: 16 }}>
        <h1>Org dashboard: {owner}</h1>
        <pre>{text}</pre>
      </div>
    );
  }

  const data = (await res.json()) as Dashboard;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Org dashboard: {data.owner}</h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            repos: <b>{data.summary.repoCount}</b> • scored: <b>{data.summary.scoredRepoCount}</b>{" "}
            • avg score: <b>{data.summary.avgScore ?? "n/a"}</b>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignSelf: "center" }}>
          <Link href={`/org/${encodeURIComponent(owner)}/alerts`}>Alerts</Link>
          <Link href={`/org/${encodeURIComponent(owner)}/policies`}>Policies</Link>
          <Link href={`/org/${encodeURIComponent(owner)}/benchmark`}>Benchmark</Link>
          <Link href="/">Home</Link>
        </div>
      </div>

      <h2 style={{ marginTop: 18 }}>Repositories</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 800 }}>
          <thead>
            <tr>
              {["Repo", "Latest score", "Δ score", "Status", "Methodology", "Last scan", "Scan"].map((h) => (
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
            {data.repos.map((r) => (
              <tr key={r.repoId}>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                  <code>{r.repoId}</code>
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                  {r.latest.totalScore ?? "n/a"}
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                  {typeof r.deltaTotalScore === "number"
                    ? r.deltaTotalScore > 0
                      ? `+${r.deltaTotalScore}`
                      : `${r.deltaTotalScore}`
                    : "—"}
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>{r.latest.status}</td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                  {r.latest.methodologyVersion ?? "—"}
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                  {new Date(r.latest.createdAt).toLocaleString()}
                </td>
                <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                  <Link href={`/scan/${r.latest.scanId}`}>open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.summary.worst.length > 0 && (
        <>
          <h2 style={{ marginTop: 18 }}>Worst scores</h2>
          <ul>
            {data.summary.worst.map((w) => (
              <li key={w.repoId}>
                <code>{w.repoId}</code>: {w.totalScore}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

