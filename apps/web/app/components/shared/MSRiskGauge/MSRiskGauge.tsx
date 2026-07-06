import styles from "./MSRiskGauge.module.css";

export type RiskScoreGaugeModel = {
  fillPercent: number;
  /** CSS band identifier. "moderate" maps to the mid-range CSS class. */
  band: "low" | "moderate" | "high";
  ariaLabel: string;
};

export type MSRiskGaugeProps = {
  gauge: RiskScoreGaugeModel;
  score: number;
  className?: string;
};

export function MSRiskGauge({ gauge, score, className }: MSRiskGaugeProps) {
  return (
    <div
      className={[styles.gauge, styles[`band_${gauge.band}`], className]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={gauge.ariaLabel}
    >
      <span className={styles.scoreValue}>{score}</span>
      <div className={styles.scoreBar} aria-hidden="true">
        <div
          className={styles.scoreBarFill}
          style={{ width: `${gauge.fillPercent}%` }}
        />
      </div>
    </div>
  );
}
