"use client";

import { useEffect, useRef, useState } from "react";
import type { PRInsight, PRDecision } from "@mergesignal/shared";
import {
  formatInsight,
  mergePostureLabel,
  ariaLabelForPosture,
  scanSurfaceCopy,
} from "@mergesignal/shared";
import styles from "./ScanClient.module.css";
import layoutStyles from "./ScanClientLayout.module.css";
import {
  MSCard,
  MSCardMuted,
  MSCardNote,
} from "../../components/shared/MSCard/MSCard";
import { MSButton } from "../../components/shared/MSButton/MSButton";

type ScanRow = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  result?: ScanResult;
  error?: string | null;
  /** DB `methodology_version` (stub scans use `engine-stub/...`). */
  methodologyVersion?: string | null;
};

function normalizeScanRow(raw: Record<string, unknown>): ScanRow {
  const methodology = (raw.methodology_version ?? raw.methodologyVersion) as
    | string
    | null
    | undefined;
  return {
    id: String(raw.id ?? ""),
    status: raw.status as ScanRow["status"],
    result: raw.result as ScanResult | undefined,
    error: (raw.error as string | null | undefined) ?? null,
    methodologyVersion: methodology ?? null,
  };
}

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
        const next = normalizeScanRow(
          JSON.parse((e as MessageEvent).data) as Record<string, unknown>,
        );
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

  if (err) return <MSCard title="Error">{err}</MSCard>;
  if (!data) return <MSCard title="Connecting">Waiting for events…</MSCard>;

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
  const showScorecard =
    data.status === "done" &&
    typeof score === "number" &&
    Number.isFinite(score);
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
      <MSCard
        title="Status"
        subtitle={
          <span className={styles.pill}>
            <span className={[styles.dot, dotClass].join(" ")} />
            {data.status}
          </span>
        }
      >
        {data.status === "running" || data.status === "queued" ? (
          <MSCardNote>This page updates automatically.</MSCardNote>
        ) : null}
        {data.status === "done" &&
          data.methodologyVersion &&
          /^engine-stub\//i.test(data.methodologyVersion) && (
            <MSCardNote>{scanSurfaceCopy.actions.demoSummaryBanner}</MSCardNote>
          )}
        {decision && data.status === "done" && (
          <div className={styles.decisionSection}>
            <span
              className={styles.decisionBadge}
              data-recommendation={decision.recommendation}
              title={`Confidence: ${decision.confidence}`}
              aria-label={ariaLabelForPosture(decision.recommendation, score)}
            >
              {decision.recommendation === "safe" && "✓ "}
              {decision.recommendation !== "safe" && "⚠ "}
              {mergePostureLabel(decision.recommendation)}
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
      </MSCard>

      <MSCard title="Risk score">
        {showScorecard ? (
          <>
            <div className={styles.score}>
              <div className={styles.scoreValue}>{score}</div>
              <div className={styles.scoreMeta}>
                {scanSurfaceCopy.product.riskIndexDirectionShort}
              </div>
            </div>
            {layers &&
            typeof layers.security === "number" &&
            typeof layers.maintainability === "number" &&
            typeof layers.ecosystem === "number" &&
            typeof layers.upgradeImpact === "number" ? (
              <MSCardNote>
                security: <b>{layers.security}</b> • maintainability:{" "}
                <b>{layers.maintainability}</b> • ecosystem:{" "}
                <b>{layers.ecosystem}</b> • upgradeImpact:{" "}
                <b>{layers.upgradeImpact}</b>
              </MSCardNote>
            ) : (
              <MSCardMuted as="div">No layer breakdown yet.</MSCardMuted>
            )}
          </>
        ) : data.status === "failed" ? (
          <MSCardMuted as="div">
            {scanSurfaceCopy.pipeline.analysisIncomplete}
          </MSCardMuted>
        ) : data.status === "running" ? (
          <MSCardMuted as="div">
            {scanSurfaceCopy.pipeline.scanRunning}
          </MSCardMuted>
        ) : (
          <MSCardMuted as="div">
            {scanSurfaceCopy.pipeline.scanIncomplete}
          </MSCardMuted>
        )}
      </MSCard>

      {data.status === "done" && (
        <MSCard title="Top actions">
          {recs.length === 0 ? (
            <MSCardMuted as="div">No recommendations yet.</MSCardMuted>
          ) : (
            <ol className={styles.list}>
              {recs.slice(0, 5).map((r) => (
                <li key={String(r.id ?? r.title)}>
                  <b>{String(r.title ?? "Untitled")}</b>{" "}
                  <MSCardMuted as="span">
                    {(() => {
                      const p = r.priorityScore;
                      return typeof p === "number" && Number.isFinite(p)
                        ? ` (${p})`
                        : "";
                    })()}
                  </MSCardMuted>
                </li>
              ))}
            </ol>
          )}
          {findings.length ? (
            <MSCardNote>
              Findings: <b>{findings.length}</b>
            </MSCardNote>
          ) : null}
        </MSCard>
      )}

      {data.status === "done" && insights.length > 0 && (
        <MSCard
          title="Critical Insights"
          subtitle={
            <MSCardMuted as="span">Key findings from code analysis</MSCardMuted>
          }
        >
          <div className={styles.insightsList}>
            {insights.map((insight, idx) => {
              const f = formatInsight(insight);
              return (
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
                  <p className={styles.insightMessage}>{f.message}</p>
                  {f.where && (
                    <p className={styles.insightAction}>
                      <strong>Where it shows up</strong>
                      {f.where}
                    </p>
                  )}
                  {f.action && (
                    <p className={styles.insightAction}>
                      <strong>What to do</strong>
                      {f.action}
                    </p>
                  )}
                  {insight.affectedFiles &&
                    insight.affectedFiles.length > 0 && (
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
                            <li>
                              ...and {insight.affectedFiles.length - 10} more
                            </li>
                          )}
                        </ul>
                      </details>
                    )}
                </div>
              );
            })}
          </div>
        </MSCard>
      )}

      {data.status === "done" && data.result?.codeAnalysisMetrics && (
        <MSCard
          title="Code Analysis"
          subtitle={
            <MSCardMuted as="span">Repository source analysis</MSCardMuted>
          }
        >
          <MSCardNote>
            Analyzed <b>{data.result.codeAnalysisMetrics.filesAnalyzed}</b>{" "}
            files
            {data.result.codeAnalysisMetrics.fromCache && " (from cache)"}
            {data.result.codeAnalysisMetrics.analysisTimeMs &&
              ` in ${(data.result.codeAnalysisMetrics.analysisTimeMs / 1000).toFixed(1)}s`}
            {data.result.codeAnalysisMetrics.timedOut && (
              <div className={styles.timeoutWarning}>
                ⚠️ Analysis timed out - results based on dependency graph only
              </div>
            )}
          </MSCardNote>
        </MSCard>
      )}

      {data.status === "done" && (
        <MSCard
          title="Why this is risky"
          subtitle={
            <MSCardMuted as="span">Top contributing signals</MSCardMuted>
          }
        >
          {reasons.length === 0 ? (
            <MSCardMuted as="div">No explainability data yet.</MSCardMuted>
          ) : (
            <ul className={styles.list}>
              {reasons.slice(0, 6).map((r) => (
                <li key={String(r.id ?? r.title)}>
                  <b>{String(r.title ?? "Reason")}</b>{" "}
                  <MSCardMuted as="span">
                    {(() => {
                      const imp = r.scoreImpact;
                      return typeof imp === "number" && Number.isFinite(imp)
                        ? ` (+${imp})`
                        : "";
                    })()}
                  </MSCardMuted>
                </li>
              ))}
            </ul>
          )}
        </MSCard>
      )}

      {data.status === "done" && (
        <MSCard
          title="Dependency graph intelligence"
          subtitle={
            <MSCardMuted as="span">
              Transitive context and nesting depth
            </MSCardMuted>
          }
        >
          {deepest.length === 0 ? (
            <MSCardMuted as="div">No graph insights yet.</MSCardMuted>
          ) : (
            <ul className={styles.list}>
              {deepest.slice(0, 5).map((x) => (
                <li key={String(x.packageName ?? x.version ?? Math.random())}>
                  <b>{String(x.packageName ?? "package")}</b>{" "}
                  <MSCardMuted as="span">
                    {x.direct ? "direct" : "transitive"} • depth{" "}
                    {typeof x.depth === "number" && Number.isFinite(x.depth)
                      ? x.depth
                      : "n/a"}
                  </MSCardMuted>
                  {Array.isArray(x.via) && x.via.length ? (
                    <MSCardNote style={{ marginTop: "var(--ms-space-xs)" }}>
                      via {x.via.join(" → ")}
                    </MSCardNote>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </MSCard>
      )}

      {data.status === "failed" && (
        <MSCard title={scanSurfaceCopy.pipeline.analysisIncomplete}>
          <MSCardMuted as="p">
            {scanSurfaceCopy.actions.failureBody}
          </MSCardMuted>
          {data.error ? (
            <details style={{ marginTop: "var(--ms-space-md)" }}>
              <summary>Details for support</summary>
              <pre className={styles.failurePre}>{data.error}</pre>
            </details>
          ) : null}
        </MSCard>
      )}

      <MSCard title="Details">
        <div className={styles.detailsActions}>
          <MSButton variant="secondary" onClick={() => setShowRaw((s) => !s)}>
            {showRaw ? "Hide" : "Show"} raw JSON
          </MSButton>
        </div>
        {showRaw ? (
          <pre className={styles.detailsPre}>
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : null}
      </MSCard>
    </div>
  );
}
