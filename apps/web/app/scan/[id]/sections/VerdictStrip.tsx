import type { ScanDetailVerdict } from "@mergesignal/shared";
import { cardPostureDisplayLabel } from "@mergesignal/shared";
import { MSBadge } from "../../../components/shared/MSBadge/MSBadge";
import { MSCard } from "../../../components/shared/MSCard/MSCard";
import styles from "../ScanDetail.module.css";

type Props = {
  verdict: ScanDetailVerdict;
};

function postureTone(
  posture: ScanDetailVerdict["posture"],
): "safe" | "review" | "risky" | "neutral" {
  if (posture === "risky") return "risky";
  if (posture === "needs_review") return "review";
  if (posture === "safe") return "safe";
  return "neutral";
}

export function VerdictStrip({ verdict }: Props) {
  const tone = postureTone(verdict.posture);

  return (
    <MSCard className={styles.verdictStrip} padding={true}>
      <div
        className={[styles.verdictFlow, styles[tone]].filter(Boolean).join(" ")}
      >
        <div className={styles.verdictRow}>
          {verdict.posture ? (
            <MSBadge
              variant="posture"
              tone={tone}
              className={styles.postureBadge}
            >
              {cardPostureDisplayLabel(verdict.posture)}
            </MSBadge>
          ) : null}
          <div className={styles.verdictMeta}>
            {verdict.scopeChip ? (
              <span className={styles.scopeChip}>{verdict.scopeChip}</span>
            ) : null}
          </div>
        </div>
        <p className={styles.verdictLine}>{verdict.verdictLine}</p>
      </div>
    </MSCard>
  );
}
