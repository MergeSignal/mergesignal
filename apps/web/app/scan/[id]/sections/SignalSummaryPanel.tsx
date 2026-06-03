"use client";

import { useState } from "react";
import type {
  ScanDetailNarrativeContext,
  ScanDetailSignalSummary,
  ScanDetailVerdict,
} from "@mergesignal/shared";
import { cardPostureDisplayLabel, scanSurfaceCopy } from "@mergesignal/shared";
import { MSRiskGauge } from "../../../components/shared/MSRiskGauge/MSRiskGauge";
import { MSBadge } from "../../../components/shared/MSBadge/MSBadge";
import { MSCard } from "../../../components/shared/MSCard/MSCard";
import styles from "../ScanDetail.module.css";

type Props = {
  verdict: ScanDetailVerdict;
  signalSummary: ScanDetailSignalSummary | null;
  followUpBridgeNote: string | null;
  narrativeContext: ScanDetailNarrativeContext;
  becauseThemes?: string[];
  confidenceCaveat?: string;
};

function postureTone(
  posture: ScanDetailVerdict["posture"],
): "safe" | "review" | "risky" | "neutral" {
  if (posture === "risky") return "risky";
  if (posture === "needs_review") return "review";
  if (posture === "safe") return "safe";
  return "neutral";
}

function layerSignalTone(
  level: ScanDetailSignalSummary["layers"][number]["concernLevel"],
): "neutral" | "warning" | "danger" {
  if (level === "high") return "danger";
  if (level === "medium") return "warning";
  return "neutral";
}

function upgradeContextParts(ctx: ScanDetailNarrativeContext): string[] {
  const parts: string[] = [];
  if (ctx.changedPackagesDisplay) parts.push(ctx.changedPackagesDisplay);
  if (ctx.runtimeSurfaceLabel) parts.push(ctx.runtimeSurfaceLabel);
  if (ctx.reachabilityLabel) parts.push(ctx.reachabilityLabel);
  if (ctx.blastRadiusLabel) parts.push(ctx.blastRadiusLabel);
  if (ctx.affectedAreas.length > 0) parts.push(ctx.affectedAreas.join(" · "));
  return parts;
}

export function SignalSummaryPanel({
  verdict,
  signalSummary,
  followUpBridgeNote,
  narrativeContext,
  becauseThemes = [],
  confidenceCaveat,
}: Props) {
  const [layersOpen, setLayersOpen] = useState(false);
  const tone = postureTone(verdict.posture);
  const copy = scanSurfaceCopy.scanDetail;
  const upgradeParts = upgradeContextParts(narrativeContext);
  const showUpgradeContext = upgradeParts.length > 0;

  return (
    <MSCard
      className={styles.scanSectionCard}
      title={copy.signalSummaryHeading}
      padding={true}
      data-prominence="signal"
    >
      <div
        className={[styles.signalSummaryVerdict, styles[tone]]
          .filter(Boolean)
          .join(" ")}
      >
        {verdict.posture ? (
          <MSBadge
            variant="posture"
            tone={tone}
            className={styles.postureBadge}
          >
            {cardPostureDisplayLabel(verdict.posture)}
          </MSBadge>
        ) : null}
        {verdict.scopeChip ? (
          <span className={styles.sectionMeta}>{verdict.scopeChip}</span>
        ) : null}
        <p className={styles.sectionLead}>{verdict.verdictLine}</p>
      </div>

      {showUpgradeContext ? (
        <div className={styles.upgradeContextBlock}>
          <h3 className={styles.sectionSubheading}>
            {copy.upgradeContextHeading}
          </h3>
          <p className={styles.sectionBody}>{upgradeParts.join(" · ")}</p>
          {narrativeContext.structuralOnlyDisclaimer ? (
            <p className={styles.sectionMeta}>
              {narrativeContext.structuralOnlyDisclaimer}
            </p>
          ) : null}
          {!narrativeContext.codeIntelligenceAvailable ? (
            <p className={styles.sectionMeta}>
              {copy.codeIntelligenceUnavailable}
            </p>
          ) : null}
        </div>
      ) : null}

      {becauseThemes.length > 0 || confidenceCaveat ? (
        <div className={styles.whyVerdictBlock}>
          <h3 className={styles.sectionSubheading}>{copy.whyVerdictHeading}</h3>
          {becauseThemes.length > 0 ? (
            <ul className={styles.whyVerdictList}>
              {becauseThemes.map((theme) => (
                <li key={theme}>{theme}</li>
              ))}
            </ul>
          ) : null}
          {confidenceCaveat ? (
            <p className={styles.sectionMeta}>{confidenceCaveat}</p>
          ) : null}
        </div>
      ) : null}

      {signalSummary ? (
        <>
          <div className={styles.signalSummaryDivider} aria-hidden="true" />
          <div className={styles.signalSummaryLayout}>
            <div className={styles.signalSummaryHero}>
              <MSRiskGauge
                gauge={signalSummary.gauge}
                score={signalSummary.score}
              />
              <div className={styles.signalSummaryBandBlock}>
                <p className={styles.sectionMeta}>{copy.scoreCaption}</p>
                <p
                  className={[
                    styles.signalSummaryBand,
                    styles[`signalSummaryBand_${signalSummary.overallBand}`],
                  ].join(" ")}
                >
                  {signalSummary.overallLabel}
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
                {copy.layersHeading}
              </summary>
              <ul className={styles.signalLayerList}>
                {signalSummary.layers.map((layer) => (
                  <li key={layer.layer} className={styles.signalLayerRow}>
                    <span className={styles.signalLayerLabel}>
                      {layer.label}
                    </span>
                    <MSBadge
                      variant="state"
                      tone={layerSignalTone(layer.concernLevel)}
                      className={styles.signalLayerBadge}
                    >
                      {layer.concernLabel}
                    </MSBadge>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </>
      ) : null}

      {followUpBridgeNote ? (
        <p className={styles.signalSummaryBridge}>{followUpBridgeNote}</p>
      ) : null}
    </MSCard>
  );
}
