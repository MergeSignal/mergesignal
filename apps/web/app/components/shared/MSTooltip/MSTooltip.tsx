"use client";

// MergeSignal design-system tooltip — the single application tooltip primitive.
// Wraps Mantine Tooltip internally. Do NOT import @mantine/core Tooltip elsewhere.
// Do NOT create feature-specific tooltip wrappers; use MSTooltip or MSTruncatedWithTooltip.
// Import path: app/components/shared/MSTooltip/MSTooltip
import { Tooltip, type TooltipProps } from "@mantine/core";
import type { MSComponentSize } from "../design-system/types";
import styles from "./MSTooltip.module.css";

const DEFAULT_EVENTS = { hover: true, focus: true, touch: false } as const;

const INTERACTIVE_CLOSE_DELAY_MS = 150;

const SIZE_CLASS: Record<MSComponentSize, string> = {
  sm: styles.sizeSm ?? "",
  md: styles.sizeMd ?? "",
  lg: styles.sizeLg ?? "",
};

export type MSTooltipProps = Omit<TooltipProps, "color" | "multiline"> & {
  /** Predefined size variant. Default `md` — body typography with standard padding. */
  size?: MSComponentSize;
  /**
   * When true, pointer events reach the tooltip so users can hover into it
   * (e.g. to select/copy text). Uses Floating UI hover bridge + closeDelay;
   * no custom mouse state. Keyboard focus remains on the trigger.
   */
  interactive?: boolean;
};

export function MSTooltip({
  size = "md",
  interactive = false,
  events = DEFAULT_EVENTS,
  closeDelay,
  classNames,
  ...rest
}: MSTooltipProps) {
  const resolvedCloseDelay =
    interactive && closeDelay === undefined
      ? INTERACTIVE_CLOSE_DELAY_MS
      : closeDelay;

  const consumerClassNames =
    classNames && typeof classNames === "object" ? classNames : {};

  return (
    <Tooltip
      {...rest}
      events={events}
      closeDelay={resolvedCloseDelay}
      classNames={{
        ...consumerClassNames,
        tooltip: [
          styles.tooltip,
          SIZE_CLASS[size],
          interactive && styles.interactive,
          consumerClassNames.tooltip,
        ]
          .filter(Boolean)
          .join(" "),
      }}
    />
  );
}
