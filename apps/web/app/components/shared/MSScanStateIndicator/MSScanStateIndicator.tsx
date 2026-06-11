import type { ScanCardPresentationState } from "@mergesignal/shared";
import { scanSurfaceCopy, staleScanSubline } from "@mergesignal/shared";
import { MSBadge } from "../MSBadge/MSBadge";
import styles from "./MSScanStateIndicator.module.css";

export type MSScanStateIndicatorProps = {
  state: ScanCardPresentationState;
  compact?: boolean;
};

const STATE_COPY: Record<
  Exclude<ScanCardPresentationState, "ready">,
  { label: string; tone: "info" | "warning" | "danger" | "neutral" }
> = {
  not_scanned: { label: "Not scanned", tone: "neutral" },
  scanning: {
    label: scanSurfaceCopy.pipeline.scanRunning,
    tone: "info",
  },
  analysis_failed: {
    label: scanSurfaceCopy.pipeline.analysisIncomplete,
    tone: "danger",
  },
  surfaces_incomplete: {
    label: scanSurfaceCopy.pipeline.surfacesNotSynchronized,
    tone: "warning",
  },
  stale: { label: "Scan outdated", tone: "warning" },
};

export function MSScanStateIndicator({
  state,
  compact = false,
}: MSScanStateIndicatorProps) {
  if (state === "ready") return null;

  const config = STATE_COPY[state];
  const showPulse = state === "scanning";

  return (
    <MSBadge
      variant="state"
      tone={config.tone}
      className={compact ? styles.compact : undefined}
      role={state === "scanning" ? "status" : undefined}
      aria-live={state === "scanning" ? "polite" : undefined}
    >
      {showPulse && <span className={styles.pulseDot} aria-hidden="true" />}
      {config.label}
    </MSBadge>
  );
}

/** Re-export for card stale subline usage. */
export { staleScanSubline };
