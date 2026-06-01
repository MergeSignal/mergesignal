"use client";

import { useState } from "react";
import type { FindingSeverity, ScanDetailViewModel } from "@mergesignal/shared";
import {
  ACT3_MAX_VISIBLE_FINDINGS,
  scanSurfaceCopy,
} from "@mergesignal/shared";
import {
  MSBadge,
  type MSBadgeTone,
} from "../../../components/shared/MSBadge/MSBadge";
import { MSCard, MSCardMuted } from "../../../components/shared/MSCard/MSCard";
import styles from "../ScanDetail.module.css";

type Props = {
  evidence: NonNullable<ScanDetailViewModel["evidence"]>;
};

function findingSeverityLabel(severity: FindingSeverity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function findingSeverityTone(severity: FindingSeverity): MSBadgeTone {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  return "neutral";
}

export function EvidencePanel({ evidence }: Props) {
  const copy = scanSurfaceCopy.scanDetail;
  const [showAllFindings, setShowAllFindings] = useState(false);

  return (
    <MSCard
      title={copy.proofHeading}
      padding={true}
      className={styles.evidencePanel}
    >
      <div className={styles.evidenceGrid}>
        {evidence.attentionAreas.length > 0 ? (
          <div className={styles.evidenceSection}>
            <h3 className={styles.evidenceSubheading}>Issues found</h3>
            {evidence.attentionAreas.map((area) => (
              <div key={area.problemLabel} className={styles.attentionArea}>
                <p className={styles.problemLabel}>{area.problemLabel}</p>
                <p className={styles.problemDescription}>
                  {area.problemDescription}
                </p>
                <ul className={styles.packageEvidenceList}>
                  {area.packages.map((pkg) => (
                    <li key={`${area.problemLabel}-${pkg.name}`}>
                      <code>{pkg.name}</code>
                      {pkg.version ? (
                        <MSCardMuted as="span"> {pkg.version}</MSCardMuted>
                      ) : null}
                      {pkg.evidence ? (
                        <MSCardMuted as="span"> · {pkg.evidence}</MSCardMuted>
                      ) : null}
                      {pkg.direct ? null : (
                        <MSCardMuted as="span"> · transitive</MSCardMuted>
                      )}
                    </li>
                  ))}
                  {area.overflowCount > 0 ? (
                    <li className={styles.overflowHint}>
                      +{area.overflowCount} more
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {evidence.findings.length > 0 ? (
          <div className={styles.evidenceSection}>
            <h3 className={styles.evidenceSubheading}>Detailed findings</h3>
            <ul className={styles.findingsList}>
              {(showAllFindings
                ? evidence.findings
                : evidence.findings.slice(0, ACT3_MAX_VISIBLE_FINDINGS)
              ).map((f) => (
                <li key={f.id} className={styles.findingRow}>
                  <MSBadge
                    variant="state"
                    tone={findingSeverityTone(f.severity)}
                    className={styles.findingSeverityBadge}
                  >
                    {findingSeverityLabel(f.severity)}
                  </MSBadge>
                  <div>
                    <p className={styles.findingTitle}>{f.title}</p>
                    <p className={styles.findingDescription}>{f.description}</p>
                    <p className={styles.findingPackage}>
                      <code>{f.packageName}</code>
                    </p>
                    {f.coveredByRecommendationRank ? (
                      <p className={styles.findingRec}>
                        {copy.recommendationDetail.coveredByRecommendation}{" "}
                        {f.coveredByRecommendationRank}
                      </p>
                    ) : f.recommendation ? (
                      <p className={styles.findingRec}>{f.recommendation}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {evidence.findingsOverflowCount > 0 ? (
              <button
                type="button"
                className={styles.expandButton}
                onClick={() => setShowAllFindings((s) => !s)}
              >
                {showAllFindings
                  ? "Show fewer findings"
                  : `${copy.moreFindingsSummary} (${evidence.findingsOverflowCount})`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </MSCard>
  );
}
