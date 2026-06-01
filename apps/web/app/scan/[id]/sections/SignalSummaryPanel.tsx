import type { ScanDetailSignalSummary } from "@mergesignal/shared";
import { scanSurfaceCopy } from "@mergesignal/shared";
import { MSRiskGauge } from "../../../components/shared/MSRiskGauge/MSRiskGauge";
import { MSBadge } from "../../../components/shared/MSBadge/MSBadge";
import { MSCard, MSCardMuted } from "../../../components/shared/MSCard/MSCard";
import styles from "../ScanDetail.module.css";

type Props = {
  signalSummary: ScanDetailSignalSummary;
};

function layerSignalTone(
  level: ScanDetailSignalSummary["layers"][number]["concernLevel"],
): "neutral" | "warning" | "danger" {
  if (level === "high") return "danger";
  if (level === "medium") return "warning";
  return "neutral";
}

export function SignalSummaryPanel({ signalSummary }: Props) {
  const copy = scanSurfaceCopy.scanDetail.signalSummary;

  return (
    <MSCard
      className={styles.signalSummaryPanel}
      title={scanSurfaceCopy.scanDetail.signalSummaryHeading}
      padding={true}
      data-prominence="signal"
    >
      <div className={styles.signalSummaryLayout}>
        <div className={styles.signalSummaryHero}>
          <MSRiskGauge
            gauge={signalSummary.gauge}
            score={signalSummary.score}
          />
          <div className={styles.signalSummaryBandBlock}>
            <p className={styles.signalSummaryCaption}>{copy.scoreCaption}</p>
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
          <h3 className={styles.signalSummarySubheading}>
            {copy.layersHeading}
          </h3>
          <ul className={styles.signalLayerList}>
            {signalSummary.layers.map((layer) => (
              <li key={layer.layer} className={styles.signalLayerRow}>
                <span className={styles.signalLayerLabel}>{layer.label}</span>
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

      {signalSummary.postureMismatchNote ? (
        <MSCardMuted as="p" className={styles.signalPostureNote}>
          {signalSummary.postureMismatchNote}
        </MSCardMuted>
      ) : null}
    </MSCard>
  );
}
