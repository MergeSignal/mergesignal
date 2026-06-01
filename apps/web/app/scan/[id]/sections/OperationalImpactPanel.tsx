"use client";

import { useState } from "react";
import type { ScanDetailOperationalImpact } from "@mergesignal/shared";
import {
  scanSurfaceCopy,
  TIER1_MAX_VISIBLE_IMPACTS,
} from "@mergesignal/shared";
import { MSCard, MSCardMuted } from "../../../components/shared/MSCard/MSCard";
import styles from "../ScanDetail.module.css";

type Props = {
  operationalImpact: ScanDetailOperationalImpact;
};

function OperationalImpactFallback({ message }: { message: string }) {
  return (
    <div className={styles.impactFallback}>
      <p className={styles.sectionBody}>{message}</p>
    </div>
  );
}

function OperationalImpactRich({
  items,
}: {
  items: ScanDetailOperationalImpact["items"];
}) {
  const [expanded, setExpanded] = useState(false);
  const copy = scanSurfaceCopy.scanDetail;

  const defaultVisible = items.slice(0, 1);
  const expandedVisible = items.slice(0, TIER1_MAX_VISIBLE_IMPACTS);
  const displayItems = expanded ? expandedVisible : defaultVisible;
  const hiddenCount = Math.max(0, items.length - displayItems.length);

  if (items.length === 0) {
    return (
      <MSCardMuted as="p">No application-level impact identified.</MSCardMuted>
    );
  }

  return (
    <>
      <div className={styles.impactGrid}>
        {displayItems.map((item, idx) => (
          <article key={idx} className={styles.impactCard}>
            <p className={styles.sectionLead}>{item.message}</p>
            {item.where ? (
              <p className={styles.impactRow}>
                <span className={styles.impactLabel}>{copy.whereLabel}</span>
                <span>{item.where}</span>
              </p>
            ) : null}
            {item.verify ? (
              <p className={styles.impactRow}>
                <span className={styles.impactLabel}>{copy.verifyLabel}</span>
                <span>{item.verify}</span>
              </p>
            ) : null}
            {item.affectedFiles && item.affectedFiles.length > 0 ? (
              <details className={styles.affectedFiles}>
                <summary>
                  {item.affectedFiles.length} file
                  {item.affectedFiles.length !== 1 ? "s" : ""} affected
                </summary>
                <ul>
                  {item.affectedFiles.slice(0, 10).map((file, i) => (
                    <li key={i}>
                      <code>{file}</code>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>
        ))}
      </div>
      {hiddenCount > 0 || (!expanded && items.length > 1) ? (
        <button
          type="button"
          className={styles.expandButton}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded
            ? "Show less"
            : `${copy.moreImpactsSummary} (${items.length - 1} more)`}
        </button>
      ) : null}
    </>
  );
}

/** Future structured impact areas (chips/cards) — shell only until engine data lands. */
function OperationalImpactStructuredShell() {
  return (
    <div className={styles.impactStructuredShell} aria-hidden="true">
      <span className={styles.impactAreaChip} />
      <span className={styles.impactAreaChip} />
      <span className={styles.impactAreaChip} />
    </div>
  );
}

export function OperationalImpactPanel({ operationalImpact }: Props) {
  const copy = scanSurfaceCopy.scanDetail;

  if (operationalImpact.status === "hidden") return null;

  return (
    <MSCard
      className={styles.scanSectionCard}
      title={copy.operationalImpactHeading}
      padding={true}
      data-prominence="signature"
    >
      {operationalImpact.status === "fallback" &&
      operationalImpact.fallbackMessage ? (
        <OperationalImpactFallback
          message={operationalImpact.fallbackMessage}
        />
      ) : null}

      {operationalImpact.status === "rich" ? (
        <OperationalImpactRich items={operationalImpact.items} />
      ) : null}

      <OperationalImpactStructuredShell />
    </MSCard>
  );
}
