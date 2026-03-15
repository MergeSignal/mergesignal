"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ScanClient.module.css";
import layoutStyles from "./ScanClientLayout.module.css";
import { Card, cardStyles } from "../../_components/ui/Card";
import { Button, Row } from "../../_components/ui/Form";
import { getApiBaseUrl } from "../../../lib/api";

type ScanRow = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  result?: ScanResult;
  error?: string | null;
};

type ScanResult = {
  totalScore?: number;
  layerScores?: {
    security: number;
    maintainability: number;
    ecosystem: number;
    upgradeImpact: number;
  };
  recommendations?: Array<{ id?: string; title?: string; priorityScore?: number }>;
  findings?: unknown[];
  explain?: {
    reasons?: Array<{ id?: string; title?: string; scoreImpact?: number }>;
  };
  graphInsights?: {
    deepest?: Array<{
      packageName?: string;
      version?: string;
      direct?: boolean;
      depth?: number;
      via?: string[];
    }>;
  };
};

export default function ScanClient({ id }: { id: string }) {
  const [data, setData] = useState<ScanRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const terminalRef = useRef(false);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    const es = new EventSource(`${baseUrl}/scan/${id}/events`);

    es.addEventListener("status", (e) => {
      try {
        const next = JSON.parse((e as MessageEvent).data) as ScanRow;
        terminalRef.current = next.status === "done" || next.status === "failed";
        setErr(null);
        setData(next);
        if (terminalRef.current) {
          es.close();
        }
      } catch {
        setErr("Failed to parse SSE payload");
      }
    });

    es.addEventListener("error", () => {
      if (terminalRef.current) return;
      setErr((prev) => prev ?? "SSE connection issue (retrying)");
    });

    return () => es.close();
  }, [id]);

  if (err) return <Card title="Error">{err}</Card>;
  if (!data) return <Card title="Connecting">Waiting for events…</Card>;

  const score = data.result?.totalScore;
  const layers = data.result?.layerScores;
  const recs = Array.isArray(data.result?.recommendations) ? data.result.recommendations : [];
  const findings = Array.isArray(data.result?.findings) ? data.result.findings : [];
  const reasons = Array.isArray(data.result?.explain?.reasons) ? data.result.explain.reasons : [];
  const graphInsights = data.result?.graphInsights;
  const deepest = Array.isArray(graphInsights?.deepest) ? graphInsights.deepest : [];
  const dotClass =
    data.status === "queued"
      ? styles.dotQueued
      : data.status === "running"
        ? styles.dotRunning
        : data.status === "done"
          ? styles.dotDone
          : styles.dotFailed;

  return (
    <div className={layoutStyles.grid}>
      <Card
        title="Status"
        subtitle={
          <span className={styles.pill}>
            <span className={[styles.dot, dotClass].join(" ")} />
            {data.status}
          </span>
        }
      >
        {data.status === "running" || data.status === "queued" ? (
          <div className={cardStyles.note}>This page updates automatically.</div>
        ) : null}
      </Card>

      <Card title="Risk score">
        <div className={styles.score}>
          <div className={styles.scoreValue}>{typeof score === "number" ? score : "n/a"}</div>
          <div className={styles.scoreMeta}>0 is best • 100 is worst</div>
        </div>
        {layers ? (
          <div className={cardStyles.note}>
            security: <b>{layers.security}</b> • maintainability: <b>{layers.maintainability}</b> • ecosystem:{" "}
            <b>{layers.ecosystem}</b> • upgradeImpact: <b>{layers.upgradeImpact}</b>
          </div>
        ) : (
          <div className={cardStyles.muted}>No layer breakdown yet.</div>
        )}
      </Card>

      {data.status === "done" && (
        <Card title="Top actions">
          {recs.length === 0 ? (
            <div className={cardStyles.muted}>No recommendations yet.</div>
          ) : (
            <ol className={styles.list}>
              {recs.slice(0, 5).map((r) => (
                <li key={String(r.id ?? r.title)}>
                  <b>{String(r.title ?? "Untitled")}</b>{" "}
                  <span className={cardStyles.muted}>({Number(r.priorityScore ?? 0)})</span>
                </li>
              ))}
            </ol>
          )}
          {findings.length ? (
            <div className={cardStyles.note}>
              Findings: <b>{findings.length}</b>
            </div>
          ) : null}
        </Card>
      )}

      {data.status === "done" && (
        <Card title="Why this is risky" subtitle={<span className={cardStyles.muted}>Top contributing signals</span>}>
          {reasons.length === 0 ? (
            <div className={cardStyles.muted}>No explainability data yet.</div>
          ) : (
            <ul className={styles.list}>
              {reasons.slice(0, 6).map((r) => (
                <li key={String(r.id ?? r.title)}>
                  <b>{String(r.title ?? "Reason")}</b>{" "}
                  <span className={cardStyles.muted}>(+{Number(r.scoreImpact ?? 0)})</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {data.status === "done" && (
        <Card
          title="Dependency graph intelligence"
          subtitle={<span className={cardStyles.muted}>Transitive context and nesting depth</span>}
        >
          {deepest.length === 0 ? (
            <div className={cardStyles.muted}>No graph insights yet.</div>
          ) : (
            <ul className={styles.list}>
              {deepest.slice(0, 5).map((x) => (
                <li key={String(x.packageName ?? x.version ?? Math.random())}>
                  <b>{String(x.packageName ?? "package")}</b>{" "}
                  <span className={cardStyles.muted}>
                    {x.direct ? "direct" : "transitive"} • depth {Number(x.depth ?? 0)}
                  </span>
                  {Array.isArray(x.via) && x.via.length ? (
                    <div className={cardStyles.note} style={{ marginTop: 6 }}>
                      via {x.via.join(" → ")}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {data.status === "failed" && (
        <Card title="Failure">
          <pre className={styles.failurePre}>{data.error}</pre>
        </Card>
      )}

      <Card title="Details">
        <Row>
          <Button variant="secondary" onClick={() => setShowRaw((s) => !s)}>
            {showRaw ? "Hide" : "Show"} raw JSON
          </Button>
        </Row>
        {showRaw ? <pre className={styles.detailsPre}>{JSON.stringify(data, null, 2)}</pre> : null}
      </Card>
    </div>
  );
}
