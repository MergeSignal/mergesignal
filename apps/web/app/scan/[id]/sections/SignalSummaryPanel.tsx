"use client";

import { useState } from "react";
import type { ScanDetailsPresentation } from "@mergesignal/shared";
import { cardPostureDisplayLabel, scanSurfaceCopy } from "@mergesignal/shared";
import type { RiskScoreGaugeModel } from "../../../components/shared/MSRiskGauge/MSRiskGauge";
import { MSRiskGauge } from "../../../components/shared/MSRiskGauge/MSRiskGauge";
import { MSBadge } from "../../../components/shared/MSBadge/MSBadge";
import { MSCard } from "../../../components/shared/MSCard/MSCard";
import styles from "../ScanDetail.module.css";

type Props = {
  status: ScanDetailsPresentation["status"];
  hero: ScanDetailsPresentation["hero"];
  narrative: ScanDetailsPresentation["narrative"];
  evidenceContext: ScanDetailsPresentation["evidenceContext"];
  signalSummary?: ScanDetailsPresentation["signalSummary"];
  usage?: ScanDetailsPresentation["usage"];
  confidenceRationale?: ScanDetailsPresentation["confidenceRationale"];
  electionSummary?: ScanDetailsPresentation["electionSummary"];
  supportingContext?: ScanDetailsPresentation["supportingContext"];
};

function postureTone(
  status: ScanDetailsPresentation["status"],
): "safe" | "review" | "risky" | "neutral" {
  if (status === "risky") return "risky";
  if (status === "needs_review") return "review";
  if (status === "safe") return "safe";
  return "neutral";
}

function layerBandTone(
  band: "low" | "medium" | "high",
): "neutral" | "warning" | "danger" {
  if (band === "high") return "danger";
  if (band === "medium") return "warning";
  return "neutral";
}

function toGaugeModel(
  ss: NonNullable<ScanDetailsPresentation["signalSummary"]>,
): RiskScoreGaugeModel {
  const band = ss.band === "medium" ? "moderate" : ss.band;
  return {
    fillPercent: ss.prRiskScore,
    band,
    ariaLabel: `PR Risk score ${ss.prRiskScore}`,
  };
}

export function SignalSummaryPanel({
  status,
  hero,
  narrative,
  evidenceContext,
  signalSummary,
  usage,
  confidenceRationale,
  electionSummary,
  supportingContext,
}: Props) {
  const [layersOpen, setLayersOpen] = useState(false);
  const tone = postureTone(status);
  const detailCopy = scanSurfaceCopy.scanDetail;
  const signalCopy = detailCopy.signalSummary;

  const overallBandLabel = hero.prRiskBandLabel ?? hero.postureLabel;
  const gauge = signalSummary ? toGaugeModel(signalSummary) : null;

  // electionSummary is only shown for multi-package PRs; on single-package
  // the verdict and upgrade context already make the anchor self-evident.
  const showElectionSummary =
    Boolean(electionSummary) && narrative.changedPackages.length > 1;

  const hasUpgradeContext =
    Boolean(hero.subheadline) ||
    narrative.changedPackages.length > 0 ||
    Boolean(usage?.summary) ||
    (usage?.frameworks.length ?? 0) > 0 ||
    showElectionSummary;

  return (
    <MSCard
      className={styles.scanSectionCard}
      title={detailCopy.signalSummaryHeading}
      padding={true}
      data-prominence="signal"
    >
      <div
        className={[styles.signalSummaryVerdict, styles[tone]]
          .filter(Boolean)
          .join(" ")}
      >
        {status ? (
          <MSBadge
            variant="posture"
            tone={tone}
            className={styles.postureBadge}
          >
            {cardPostureDisplayLabel(status)}
          </MSBadge>
        ) : null}
        {hero.scopeChip ? (
          <span className={styles.sectionMeta}>{hero.scopeChip}</span>
        ) : null}
        <p className={styles.sectionLead}>{hero.verdictLine}</p>
        {confidenceRationale ? (
          <p className={styles.sectionMeta}>{confidenceRationale}</p>
        ) : null}
      </div>

      {hasUpgradeContext ? (
        <div className={styles.upgradeContextBlock}>
          <h3 className={styles.sectionSubheading}>
            {detailCopy.upgradeContextHeading}
          </h3>
          {hero.subheadline ? (
            <p className={styles.sectionBody}>{hero.subheadline}</p>
          ) : null}
          {narrative.changedPackages.length > 0 ? (
            <p className={styles.sectionBody}>
              {narrative.changedPackages.join(", ")}
            </p>
          ) : null}
          {showElectionSummary ? (
            <p className={styles.sectionBody}>{electionSummary}</p>
          ) : null}
          {usage?.summary || (usage?.frameworks.length ?? 0) > 0 ? (
            <>
              <h3 className={styles.sectionSubheading}>Usage in codebase</h3>
              {usage?.summary ? (
                <p className={styles.sectionBody}>{usage.summary}</p>
              ) : null}
              {usage && usage.frameworks.length > 0 ? (
                <p className={styles.sectionBody}>
                  {usage.frameworks.slice(0, 3).join(", ")}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {narrative.keyPoints.length > 0 || evidenceContext.degradedMessage ? (
        <div className={styles.whyVerdictBlock}>
          <h3 className={styles.sectionSubheading}>
            {detailCopy.whyVerdictHeading}
          </h3>
          {narrative.keyPoints.length > 0 ? (
            <ul className={styles.whyVerdictList}>
              {narrative.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
          {evidenceContext.degradedMessage ? (
            <p className={styles.sectionMeta}>
              {evidenceContext.degradedMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {gauge && signalSummary ? (
        <>
          <div className={styles.signalSummaryDivider} aria-hidden="true" />
          <div className={styles.signalSummaryLayout}>
            <div className={styles.signalSummaryHero}>
              <MSRiskGauge gauge={gauge} score={signalSummary.prRiskScore} />
              <div className={styles.signalSummaryBandBlock}>
                <p className={styles.sectionMeta}>{signalCopy.scoreCaption}</p>
                <p
                  className={[
                    styles.signalSummaryBand,
                    styles[`signalSummaryBand_${gauge.band}`],
                  ].join(" ")}
                >
                  {overallBandLabel}
                </p>
              </div>
            </div>

            <details
              className={styles.signalSummaryLayers}
              open={layersOpen}
              onToggle={(e) =>
                setLayersOpen((e.target as HTMLDetailsElement).open)
              }
            >
              <summary className={styles.sectionSubheading}>
                {signalCopy.layersHeading}
              </summary>
              <ul className={styles.signalLayerList}>
                {signalSummary.layers.map((layer) => (
                  <li key={layer.layer} className={styles.signalLayerRow}>
                    <span className={styles.signalLayerLabel}>
                      {layer.label}
                    </span>
                    <MSBadge
                      variant="state"
                      tone={layerBandTone(layer.band)}
                      className={styles.signalLayerBadge}
                    >
                      {layer.band}
                    </MSBadge>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </>
      ) : null}

      {supportingContext && supportingContext.lines.length > 0 ? (
        <details className={styles.supportingContextDetails}>
          <summary>{supportingContext.title}</summary>
          <div className={styles.supportingContextLines}>
            {supportingContext.lines.map((line) => (
              <p key={line} className={styles.sectionMeta}>
                {line}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </MSCard>
  );
}
