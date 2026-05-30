"use client";

// Thin composition: truncation CSS + overflow measurement + conditional MSTooltip.
// Not for business logic, formatting, or per-use-case wrappers (titles, branches, cells).
// Import path: app/components/shared/MSTruncatedWithTooltip/MSTruncatedWithTooltip
import { useRef, type HTMLAttributes, type ReactNode } from "react";
import { useIsTruncated } from "../hooks/useIsTruncated";
import { MSTooltip, type MSTooltipProps } from "../MSTooltip/MSTooltip";
import styles from "./MSTruncatedWithTooltip.module.css";

export type MSTruncatedWithTooltipProps = {
  children: ReactNode;
  /** Tooltip content when truncated. Defaults to `children`. */
  tooltip?: ReactNode;
  as?: "span" | "div";
  className?: string;
  tooltipProps?: Omit<MSTooltipProps, "label" | "children" | "disabled">;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

export function MSTruncatedWithTooltip({
  children,
  tooltip,
  as: Component = "span",
  className,
  tooltipProps,
  ...rest
}: MSTruncatedWithTooltipProps) {
  const ref = useRef<HTMLSpanElement & HTMLDivElement>(null);
  const isTruncated = useIsTruncated(ref);
  const label = tooltip ?? children;

  return (
    <MSTooltip label={label} disabled={!isTruncated} {...tooltipProps}>
      <Component
        ref={ref}
        className={[styles.truncated, className].filter(Boolean).join(" ")}
        {...rest}
      >
        {children}
      </Component>
    </MSTooltip>
  );
}
