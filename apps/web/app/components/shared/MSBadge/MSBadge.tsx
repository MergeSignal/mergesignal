import styles from "./MSBadge.module.css";

export type MSBadgeVariant = "posture" | "state" | "count";
export type MSBadgeTone =
  | "safe"
  | "review"
  | "risky"
  | "neutral"
  | "info"
  | "warning"
  | "danger";

export type MSBadgeProps = {
  variant?: MSBadgeVariant;
  tone?: MSBadgeTone;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>;

export function MSBadge({
  variant = "state",
  tone = "neutral",
  children,
  className,
  ...rest
}: MSBadgeProps) {
  const rootClass = [styles.badge, styles[variant], styles[tone], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={rootClass}
      data-variant={variant}
      data-tone={tone}
      {...rest}
    >
      {children}
    </span>
  );
}
