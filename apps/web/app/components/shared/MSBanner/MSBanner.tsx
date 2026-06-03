"use client";

import { useState, type ReactNode } from "react";
import styles from "./MSBanner.module.css";

export type MSBannerTone = "neutral" | "info" | "warning" | "danger" | "safe";

export type MSBannerProps = {
  tone?: MSBannerTone;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
};

function bannerRole(tone: MSBannerTone): "status" | undefined {
  return tone === "danger" ? undefined : "status";
}

export function MSBanner({
  tone = "neutral",
  title,
  description,
  children,
  dismissible = false,
  onDismiss,
  className,
}: MSBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const rootClass = [styles.banner, styles[tone], className]
    .filter(Boolean)
    .join(" ");

  const hasBody = title != null || description != null || children != null;

  return (
    <div className={rootClass} data-tone={tone} role={bannerRole(tone)}>
      <span className={styles.accent} aria-hidden="true" />
      {hasBody ? (
        <div className={styles.content}>
          {title != null ? <p className={styles.title}>{title}</p> : null}
          {description != null ? (
            <p className={styles.description}>{description}</p>
          ) : null}
          {children}
        </div>
      ) : null}
      {dismissible ? (
        <button
          type="button"
          className={styles.dismiss}
          aria-label="Dismiss message"
          onClick={handleDismiss}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}
