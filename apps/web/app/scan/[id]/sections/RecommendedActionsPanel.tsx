"use client";

import { useState } from "react";
import type { ScanDetailRecommendationCenter } from "@mergesignal/shared";
import { scanSurfaceCopy } from "@mergesignal/shared";
import { MSCard, MSCardMuted } from "../../../components/shared/MSCard/MSCard";
import styles from "../ScanDetail.module.css";

type Props = {
  recommendedActions: ScanDetailRecommendationCenter;
};

function priorityLabel(
  priority: ScanDetailRecommendationCenter["items"][number]["priority"],
): string {
  const copy = scanSurfaceCopy.scanDetail.recommendationPriority;
  if (priority === "high") return copy.high;
  if (priority === "medium") return copy.medium;
  return copy.low;
}

export function RecommendedActionsPanel({ recommendedActions }: Props) {
  const copy = scanSurfaceCopy.scanDetail;
  const detailCopy = copy.recommendationDetail;
  const items = recommendedActions.items;

  const [selectedId, setSelectedId] = useState(
    recommendedActions.defaultSelectedId || items[0]?.id || "",
  );

  if (items.length === 0) return null;

  const selected = items.find((item) => item.id === selectedId) ?? items[0]!;

  return (
    <MSCard
      className={styles.scanSectionCard}
      title={recommendedActions.heading}
      padding={true}
      data-prominence="recommendations"
    >
      <div className={styles.recommendationLayout}>
        <nav
          className={styles.actionRail}
          aria-label={recommendedActions.heading}
        >
          <p className={styles.actionRailHint}>{detailCopy.selectPrompt}</p>
          <ol className={styles.actionRailList}>
            {items.map((item) => {
              const isSelected = item.id === selected.id;
              return (
                <li key={item.id} className={styles.actionRailItem}>
                  <button
                    type="button"
                    className={[
                      styles.actionRailButton,
                      isSelected ? styles.actionRailButtonSelected : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-selected={isSelected}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className={styles.actionRailIndex}>{item.rank}</span>
                    <span className={styles.actionRailTitle}>{item.title}</span>
                    <span
                      className={[
                        styles.actionRailPriority,
                        styles[`actionRailPriority_${item.priority}`],
                      ].join(" ")}
                    >
                      {priorityLabel(item.priority)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div
          className={styles.recommendationDetailPane}
          aria-live="polite"
          key={selected.id}
        >
          {recommendedActions.scanContext ? (
            <p
              className={[styles.sectionBody, styles.recommendationScanContext]
                .filter(Boolean)
                .join(" ")}
            >
              {recommendedActions.scanContext}
            </p>
          ) : null}

          <div className={styles.detailBlock}>
            <h3 className={styles.sectionSubheading}>{detailCopy.whyLabel}</h3>
            <p className={styles.sectionBody}>{selected.detail.why}</p>
          </div>

          <div className={styles.detailBlock}>
            <h3 className={styles.sectionSubheading}>
              {detailCopy.whyNowLabel}
            </h3>
            <p className={styles.sectionLead}>{selected.detail.whyNow}</p>
          </div>

          {selected.detail.signals.length > 0 ? (
            <div className={styles.detailBlock}>
              <h3 className={styles.sectionSubheading}>
                {detailCopy.signalsLabel}
              </h3>
              <ul className={styles.signalList}>
                {selected.detail.signals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {selected.detail.affectedPackages ? (
            <div className={styles.detailBlock}>
              <h3 className={styles.sectionSubheading}>
                {detailCopy.affectedPackagesLabel}
              </h3>
              <div className={styles.packageChipRow}>
                {selected.detail.affectedPackages.names.map((pkg) => (
                  <code key={pkg} className={styles.packageChip}>
                    {pkg}
                  </code>
                ))}
                {selected.detail.affectedPackages.overflowCount > 0 ? (
                  <MSCardMuted as="span" className={styles.packageOverflow}>
                    +{selected.detail.affectedPackages.overflowCount} more
                  </MSCardMuted>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={styles.detailBlock}>
            <h3 className={styles.sectionSubheading}>
              {detailCopy.expectedBenefitLabel}
            </h3>
            <p className={styles.sectionLead}>
              {selected.detail.expectedBenefit}
            </p>
          </div>
        </div>
      </div>
    </MSCard>
  );
}
