"use client";

import { Check, Copy } from "lucide-react";
import { CopyButton } from "@mantine/core";
import styles from "./MSCodeBlock.module.css";

export type MSCodeBlockProps = {
  /** Raw text shown in the block (and copied). */
  text: string;
  copyLabel?: string;
};

/**
 * Bordered code panel: code and copy control in a flex row with token gap.
 * CopyButton from Mantine manages the copy state and timeout — the visual
 * button and all styling remain CSS-Module-based with --ms-* tokens.
 */
export function MSCodeBlock({
  text,
  copyLabel = "Copy to clipboard",
}: MSCodeBlockProps) {
  return (
    <div className={styles.shell} data-ms-code-block>
      <pre className={styles.pre}>
        <code>{text}</code>
      </pre>
      <CopyButton value={text} timeout={2000}>
        {({ copied, copy }) => (
          <button
            type="button"
            className={styles.copyBtn}
            onClick={copy}
            aria-label={copied ? "Copied" : copyLabel}
            title={copied ? "Copied" : copyLabel}
          >
            {copied ? (
              <Check size={16} strokeWidth={2} aria-hidden />
            ) : (
              <Copy size={16} strokeWidth={2} aria-hidden />
            )}
          </button>
        )}
      </CopyButton>
    </div>
  );
}
