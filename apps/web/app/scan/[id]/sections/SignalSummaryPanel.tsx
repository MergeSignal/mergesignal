import type {
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

export function SignalSummaryPanel({
  verdict,
  signalSummary,
  followUpBridgeNote,
}: Props) {
  const tone = postureTone(verdict.posture);
  const copy = scanSurfaceCopy.scanDetail.signalSummary;

  return (
    <MSCard
      className={styles.scanSectionCard}
      title={scanSurfaceCopy.scanDetail.signalSummaryHeading}
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
        <p className={styles.sectionLead}>{verdict.verdictLine}</p>
      </div>

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

            <div className={styles.signalSummaryLayers}>
              <h3 className={styles.sectionSubheading}>{copy.layersHeading}</h3>
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
            </div>
          </div>
        </>
      ) : null}

      {followUpBridgeNote ? (
        <p className={styles.signalSummaryBridge}>{followUpBridgeNote}</p>
      ) : null}
    </MSCard>
  );
}
