"use client";

import { useEffect, useRef, useState } from "react";
import type { PRInsight, PRDecision } from "@mergesignal/shared";
import styles from "./ScanClient.module.css";
import layoutStyles from "./ScanClientLayout.module.css";
import { Card, cardStyles } from "../../_components/ui/Card";
import { Button, Row } from "../../_components/ui/Form";

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
  recommendations?: Array<{
    id?: string;
    title?: string;
    priorityScore?: number;
  }>;
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
  insights?: PRInsight[];
  decision?: PRDecision;
  codeAnalysisMetrics?: {
    fromCache: boolean;
    analysisTimeMs?: number;
    timedOut?: boolean;
    filesAnalyzed: number;
  };
};

export default function ScanClient({
  id,
  initialRow,
}: {
  id: string;
  initialRow?: ScanRow | null;
}) {
  const [data, setData] = useState<ScanRow | null>(initialRow ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const terminalRef = useRef(
    initialRow?.status === "done" || initialRow?.status === "failed",
  );

  useEffect(() => {
    if (terminalRef.current) {
      return;
    }

    const es = new EventSource(`/api/scan/${encodeURIComponent(id)}/events`);

    es.addEventListener("status", (e) => {
      try {
        const next = JSON.parse((e as MessageEvent).data) as ScanRow;
        terminalRef.current =
          next.status === "done" || next.status === "failed";
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
  }, [id, initialRow?.status]);

  if (err) return <Card title="Error">{err}</Card>;
  if (!data) return <Card title="Connecting">Waiting for events…</Card>;

  const score = data.result?.totalScore;
  const layers = data.result?.layerScores;
  const recs = Array.isArray(data.result?.recommendations)
    ? data.result.recommendations
    : [];
  const findings = Array.isArray(data.result?.findings)
    ? data.result.findings
    : [];
  const reasons = Array.isArray(data.result?.explain?.reasons)
    ? data.result.explain.reasons
    : [];
  const graphInsights = data.result?.graphInsights;
  const deepest = Array.isArray(graphInsights?.deepest)
    ? graphInsights.deepest
    : [];
  const insights = Array.isArray(data.result?.insights)
    ? data.result.insights
    : [];
  const decision = data.result?.decision;
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
          <div className={cardStyles.note}>
            This page updates automatically.
          </div>
        ) : null}
        {decision && data.status === "done" && (
          <div style={{ marginTop: 12 }}>
            <span
              className={styles.decisionBadge}
              data-recommendation={decision.recommendation}
              title={`Confidence: ${decision.confidence}`}
            >
              {decision.recommendation === "safe" && "✓ Safe to merge"}
              {decision.recommendation === "needs_review" && "⚠ Needs review"}
              {decision.recommendation === "risky" && "⚠ Risky"}
            </span>
            {decision.reasoning && decision.reasoning.length > 0 && (
              <ul className={styles.decisionReasoning}>
                {decision.reasoning.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card title="Risk score">
        <div className={styles.score}>
          <div className={styles.scoreValue}>
            {typeof score === "number" ? score : "n/a"}
          </div>
          <div className={styles.scoreMeta}>0 is best • 100 is worst</div>
        </div>
        {layers ? (
          <div className={cardStyles.note}>
            security: <b>{layers.security}</b> • maintainability:{" "}
            <b>{layers.maintainability}</b> • ecosystem:{" "}
            <b>{layers.ecosystem}</b> • upgradeImpact:{" "}
            <b>{layers.upgradeImpact}</b>
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
                  <span className={cardStyles.muted}>
                    ({Number(r.priorityScore ?? 0)})
                  </span>
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

      {data.status === "done" && insights.length > 0 && (
        <Card
          title="Critical Insights"
          subtitle={
            <span className={cardStyles.muted}>
              Key findings from code analysis
            </span>
          }
        >
          <div className={styles.insightsList}>
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className={styles.insight}
                data-priority={insight.priority}
              >
                <div className={styles.insightHeader}>
                  <span
                    className={styles.priorityBadge}
                    data-priority={insight.priority}
                  >
                    {insight.priority}
                  </span>
                  <span className={styles.insightType}>
                    {insight.type.replace(/_/g, " ")}
                  </span>
                </div>
                <p className={styles.insightMessage}>{insight.message}</p>
                {"context" in insight && insight.context && (
                  <p className={styles.insightAction}>
                    <strong>Context:</strong> {insight.context}
                  </p>
                )}
                {"remediation" in insight && insight.remediation && (
                  <p className={styles.insightAction}>
                    <strong>Remediation:</strong> {insight.remediation}
                  </p>
                )}
                {insight.affectedFiles && insight.affectedFiles.length > 0 && (
                  <details className={styles.affectedFiles}>
                    <summary>
                      {insight.affectedFiles.length} file(s) affected
                    </summary>
                    <ul>
                      {insight.affectedFiles.slice(0, 10).map((file, i) => (
                        <li key={i}>
                          <code>{file}</code>
                        </li>
                      ))}
                      {insight.affectedFiles.length > 10 && (
                        <li>...and {insight.affectedFiles.length - 10} more</li>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.status === "done" && data.result?.codeAnalysisMetrics && (
        <Card
          title="Code Analysis"
          subtitle={
            <span className={cardStyles.muted}>Repository source analysis</span>
          }
        >
          <div className={cardStyles.note}>
            Analyzed <b>{data.result.codeAnalysisMetrics.filesAnalyzed}</b>{" "}
            files
            {data.result.codeAnalysisMetrics.fromCache && " (from cache)"}
            {data.result.codeAnalysisMetrics.analysisTimeMs &&
              ` in ${(data.result.codeAnalysisMetrics.analysisTimeMs / 1000).toFixed(1)}s`}
            {data.result.codeAnalysisMetrics.timedOut && (
              <div style={{ marginTop: 8, color: "#856404" }}>
                ⚠️ Analysis timed out - results based on dependency graph only
              </div>
            )}
          </div>
        </Card>
      )}

      {data.status === "done" && (
        <Card
          title="Why this is risky"
          subtitle={
            <span className={cardStyles.muted}>Top contributing signals</span>
          }
        >
          {reasons.length === 0 ? (
            <div className={cardStyles.muted}>No explainability data yet.</div>
          ) : (
            <ul className={styles.list}>
              {reasons.slice(0, 6).map((r) => (
                <li key={String(r.id ?? r.title)}>
                  <b>{String(r.title ?? "Reason")}</b>{" "}
                  <span className={cardStyles.muted}>
                    (+{Number(r.scoreImpact ?? 0)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {data.status === "done" && (
        <Card
          title="Dependency graph intelligence"
          subtitle={
            <span className={cardStyles.muted}>
              Transitive context and nesting depth
            </span>
          }
        >
          {deepest.length === 0 ? (
            <div className={cardStyles.muted}>No graph insights yet.</div>
          ) : (
            <ul className={styles.list}>
              {deepest.slice(0, 5).map((x) => (
                <li key={String(x.packageName ?? x.version ?? Math.random())}>
                  <b>{String(x.packageName ?? "package")}</b>{" "}
                  <span className={cardStyles.muted}>
                    {x.direct ? "direct" : "transitive"} • depth{" "}
                    {Number(x.depth ?? 0)}
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
        {showRaw ? (
          <pre className={styles.detailsPre}>
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : null}
      </Card>
    </div>
  );
}
