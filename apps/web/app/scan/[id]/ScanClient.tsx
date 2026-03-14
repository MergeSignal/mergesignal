"use client";

import { useEffect, useState } from "react";

type ScanRow = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  result?: any;
  error?: string | null;
};

export default function ScanClient({ id }: { id: string }) {
  const [data, setData] = useState<ScanRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const es = new EventSource(`${baseUrl}/scan/${id}/events`);

    es.addEventListener("status", (e) => {
      try {
        setData(JSON.parse((e as MessageEvent).data));
      } catch {
        setErr("Failed to parse SSE payload");
      }
    });

    es.addEventListener("error", () => {
      setErr((prev) => prev ?? "SSE connection issue (retrying)");
    });

    return () => es.close();
  }, [id]);

  if (err) return <div style={{ padding: 16 }}>Error: {err}</div>;
  if (!data) return <div style={{ padding: 16 }}>Connecting…</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>Scan {data.id}</h1>
      <p>
        Status: <b>{data.status}</b>
      </p>

      {data.status === "done" && (
        <>
          <h2>Result</h2>
          <pre>{JSON.stringify(data.result, null, 2)}</pre>
        </>
      )}

      {data.status === "failed" && (
        <>
          <h2>Failed</h2>
          <pre>{data.error}</pre>
        </>
      )}
    </div>
  );
}
