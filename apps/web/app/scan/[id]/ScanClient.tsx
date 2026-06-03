"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ScanResult } from "@mergesignal/shared";
import {
  deriveScanDetailViewModel,
  scanSurfaceCopy,
} from "@mergesignal/shared";
import layoutStyles from "./ScanClientLayout.module.css";
import detailStyles from "./ScanDetail.module.css";
import {
  MSCard,
  MSCardMuted,
  MSCardNote,
} from "../../components/shared/MSCard/MSCard";
import { EvidencePanel } from "./sections/EvidencePanel";
import { OperationalImpactPanel } from "./sections/OperationalImpactPanel";
import { RecommendedActionsPanel } from "./sections/RecommendedActionsPanel";
import { SignalSummaryPanel } from "./sections/SignalSummaryPanel";
import { ScanBreadcrumb } from "./sections/ScanBreadcrumb";
import { ScanDebugPanel } from "./sections/ScanDebugPanel";
import { ScanMetadataFooter } from "./sections/ScanMetadataFooter";

export type ScanRow = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  result?: ScanResult;
  error?: string | null;
  methodologyVersion?: string | null;
  repoId?: string;
  githubPrNumber?: number | null;
  githubHeadSha?: string | null;
  isStale?: boolean;
};

function normalizeScanRow(
  raw: Record<string, unknown>,
  extras?: Partial<ScanRow>,
): ScanRow {
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
    ...extras,
  };
}

function parseRepoParts(repoId: string | undefined): {
  owner: string;
  repo: string;
} {
  if (!repoId?.includes("/")) return { owner: "", repo: "" };
  const [owner = "", repo = ""] = repoId.split("/", 2);
  return { owner, repo };
}

export default function ScanClient({
  id,
  initialRow,
  allowDebug = false,
}: {
  id: string;
  initialRow?: ScanRow | null;
  allowDebug?: boolean;
}) {
  const searchParams = useSearchParams();
  const showDebug = allowDebug && searchParams.get("debug") === "1";

  const [data, setData] = useState<ScanRow | null>(initialRow ?? null);
  const [err, setErr] = useState<string | null>(null);
  const terminalRef = useRef(
    initialRow?.status === "done" || initialRow?.status === "failed",
  );

  useEffect(() => {
    if (terminalRef.current) return;

    const es = new EventSource(`/api/scan/${encodeURIComponent(id)}/events`);

    es.addEventListener("status", (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as Record<
          string,
          unknown
        >;
        const next = normalizeScanRow(parsed, {
          repoId: data?.repoId,
          githubPrNumber: data?.githubPrNumber,
          githubHeadSha: data?.githubHeadSha,
          isStale: data?.isStale,
        });
        terminalRef.current =
          next.status === "done" || next.status === "failed";
        setErr(null);
        setData(next);
        if (terminalRef.current) es.close();
      } catch {
        setErr("Failed to parse SSE payload");
      }
    });

    es.addEventListener("error", () => {
      if (terminalRef.current) return;
      setErr((prev) => prev ?? "SSE connection issue (retrying)");
    });

    return () => es.close();
  }, [
    id,
    initialRow?.status,
    data?.repoId,
    data?.githubPrNumber,
    data?.githubHeadSha,
    data?.isStale,
  ]);

  const viewModel = useMemo(() => {
    if (!data || data.status !== "done" || !data.result) return null;
    return deriveScanDetailViewModel(data.result, {
      scanId: data.id,
      status: data.status,
      methodologyVersion: data.methodologyVersion,
      prNumber: data.githubPrNumber,
    });
  }, [data]);

  const { owner, repo } = parseRepoParts(data?.repoId);

  if (err) return <MSCard title="Error">{err}</MSCard>;
  if (!data) return <MSCard title="Connecting">Waiting for events…</MSCard>;

  const dotClass =
    data.status === "queued"
      ? detailStyles.dotQueued
      : data.status === "running"
        ? detailStyles.dotRunning
        : data.status === "done"
          ? detailStyles.dotDone
          : detailStyles.dotFailed;

  return (
    <div className={layoutStyles.pageStack}>
      {owner && repo ? (
        <ScanBreadcrumb owner={owner} repo={repo} stale={data.isStale} />
      ) : null}

      {(data.status === "queued" || data.status === "running") && (
        <MSCard className={detailStyles.pipelineCard} title="Scan in progress">
          <MSCardNote>
            <span className={detailStyles.pill}>
              <span className={[detailStyles.dot, dotClass].join(" ")} />
              {data.status}
            </span>
          </MSCardNote>
          <MSCardMuted as="p">
            {scanSurfaceCopy.scanDetail.scanPipelineNote}
          </MSCardMuted>
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
              <pre className={detailStyles.failurePre}>{data.error}</pre>
            </details>
          ) : null}
        </MSCard>
      )}

      {data.status === "done" &&
        data.methodologyVersion &&
        /^engine-stub\//i.test(data.methodologyVersion) && (
          <MSCardNote className={detailStyles.demoBanner}>
            {scanSurfaceCopy.actions.demoSummaryBanner}
          </MSCardNote>
        )}

      {viewModel ? (
        <>
          <SignalSummaryPanel
            verdict={viewModel.verdict}
            signalSummary={viewModel.signalSummary}
            followUpBridgeNote={viewModel.followUpBridgeNote}
            narrativeContext={viewModel.narrativeContext}
            becauseThemes={viewModel.because?.themes}
            confidenceCaveat={viewModel.because?.confidenceCaveat}
          />
          <RecommendedActionsPanel
            recommendedActions={viewModel.recommendedActions}
          />
          <OperationalImpactPanel
            operationalImpact={viewModel.operationalImpact}
          />
          {viewModel.evidence ? (
            <EvidencePanel evidence={viewModel.evidence} />
          ) : null}
          <ScanMetadataFooter metadata={viewModel.metadata} />
        </>
      ) : data.status === "done" ? (
        <MSCard title="Scan complete">
          <MSCardMuted as="p">
            No structured results available for this scan.
          </MSCardMuted>
        </MSCard>
      ) : null}

      {showDebug ? <ScanDebugPanel data={data} /> : null}
    </div>
  );
}
