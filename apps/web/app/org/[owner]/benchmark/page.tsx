import Link from "next/link";

type Summary = {
  scope: "global" | "owner";
  owner?: string;
  repoCount: number;
  avgTotalScore: number | null;
  medianTotalScore: number | null;
  p10TotalScore: number | null;
  p25TotalScore: number | null;
  p75TotalScore: number | null;
  p90TotalScore: number | null;
  worst: Array<{ repoId: string; totalScore: number; createdAt: string }>;
  best: Array<{ repoId: string; totalScore: number; createdAt: string }>;
};

export default async function Page({ params }: { params: Promise<{ owner: string }> }) {
  const { owner } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  const [globalRes, ownerRes] = await Promise.all([
    fetch(`${baseUrl}/benchmark/global`, { cache: "no-store" }),
    fetch(`${baseUrl}/benchmark/org/${encodeURIComponent(owner)}`, { cache: "no-store" }),
  ]);

  if (!globalRes.ok || !ownerRes.ok) {
    const t1 = await globalRes.text();
    const t2 = await ownerRes.text();
    return (
      <div style={{ padding: 16 }}>
        <h1>Benchmark: {owner}</h1>
        <pre>{t1}</pre>
        <pre>{t2}</pre>
      </div>
    );
  }

  const global = (await globalRes.json()) as Summary;
  const org = (await ownerRes.json()) as Summary;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Benchmark: {owner}</h1>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            Higher <code>totalScore</code> means higher relative risk.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignSelf: "center" }}>
          <Link href={`/org/${encodeURIComponent(owner)}`}>Dashboard</Link>
          <Link href={`/org/${encodeURIComponent(owner)}/alerts`}>Alerts</Link>
          <Link href={`/org/${encodeURIComponent(owner)}/policies`}>Policies</Link>
          <Link href="/">Home</Link>
        </div>
      </div>

      <h2 style={{ marginTop: 18 }}>Global distribution</h2>
      <SummaryCards s={global} />

      <h2 style={{ marginTop: 18 }}>Org distribution</h2>
      <SummaryCards s={org} />

      <h2 style={{ marginTop: 18 }}>Org worst (highest risk)</h2>
      <RepoList rows={org.worst} />

      <h2 style={{ marginTop: 18 }}>Org best (lowest risk)</h2>
      <RepoList rows={org.best} />
    </div>
  );
}

function SummaryCards({ s }: { s: Summary }) {
  const items: Array<[string, any]> = [
    ["repos", s.repoCount],
    ["avg", s.avgTotalScore ?? "n/a"],
    ["median", s.medianTotalScore ?? "n/a"],
    ["p10", s.p10TotalScore ?? "n/a"],
    ["p25", s.p25TotalScore ?? "n/a"],
    ["p75", s.p75TotalScore ?? "n/a"],
    ["p90", s.p90TotalScore ?? "n/a"],
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{k}</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function RepoList({ rows }: { rows: Array<{ repoId: string; totalScore: number; createdAt: string }> }) {
  if (!rows.length) return <div style={{ opacity: 0.8 }}>No scored repos yet.</div>;
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.repoId}>
          <code>{r.repoId}</code> — <b>{r.totalScore}</b> ({new Date(r.createdAt).toLocaleString()})
        </li>
      ))}
    </ul>
  );
}

