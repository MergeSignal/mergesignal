import { MSTooltip } from "../MSTooltip/MSTooltip";
import styles from "./MSChip.module.css";

export type MSChipProps = {
  label: string;
  tooltip?: string;
  className?: string;
};

export function MSChip({ label, tooltip, className }: MSChipProps) {
  const chip = (
    <span className={[styles.chip, className].filter(Boolean).join(" ")}>
      {label}
    </span>
  );

  if (tooltip && tooltip !== label) {
    return (
      <MSTooltip
        label={tooltip}
        position="bottom"
        events={{ hover: true, focus: true, touch: false }}
      >
        <span className={styles.tooltipWrap}>{chip}</span>
      </MSTooltip>
    );
  }

  return chip;
}
