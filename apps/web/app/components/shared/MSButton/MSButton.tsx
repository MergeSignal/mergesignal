// Application-owned button primitive. Mantine is an implementation detail.
// Do NOT import @mantine/core/Button in feature code — use this instead.
// Import path: app/components/shared/MSButton/MSButton
import { Button } from "@mantine/core";
import styles from "./MSButton.module.css";

export type MSButtonProps = {
  variant?: "primary" | "secondary";
  loading?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">;

export function MSButton({
  variant = "primary",
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: MSButtonProps) {
  const mantineVariant = variant === "secondary" ? "subtle" : "filled";

  return (
    <Button
      variant={mantineVariant}
      loading={loading}
      disabled={disabled}
      classNames={{
        root: [styles.button, styles[variant], className]
          .filter(Boolean)
          .join(" "),
      }}
      // Forward all standard button HTML attributes via the underlying element.
      // Mantine's Button accepts these through its polymorphic component API.
      {...(rest as React.ComponentPropsWithoutRef<"button">)}
    >
      {children}
    </Button>
  );
}
