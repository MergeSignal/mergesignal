// Application-owned tooltip. Wraps Mantine Tooltip internally.
// Do NOT import @mantine/core/Tooltip in feature code — use this instead.
// Import path: app/components/shared/MSTooltip/MSTooltip
import { Tooltip, type TooltipProps } from "@mantine/core";

export type MSTooltipProps = TooltipProps;

export function MSTooltip(props: MSTooltipProps) {
  return <Tooltip {...props} />;
}
