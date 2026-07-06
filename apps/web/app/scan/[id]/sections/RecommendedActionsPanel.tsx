"use client";

import { useState } from "react";
import type { ScanDetailsPresentation } from "@mergesignal/shared";
import { scanSurfaceCopy } from "@mergesignal/shared";
import { MSCard, MSCardMuted } from "../../../components/shared/MSCard/MSCard";
import styles from "../ScanDetail.module.css";

type RecommendationItem =
  ScanDetailsPresentation["recommendations"]["items"][number];

type Props = {
  recommendations: ScanDetailsPresentation["recommendations"];
};

function priorityLabel(priority: RecommendationItem["priority"]): string {
  const copy = scanSurfaceCopy.scanDetail.recommendationPriority;
  if (priority === "high") return copy.high;
  if (priority === "medium") return copy.medium;
  return copy.low;
}

export function RecommendedActionsPanel({ recommendations }: Props) {
  const copy = scanSurfaceCopy.scanDetail;
  const detailCopy = copy.recommendationDetail;
  const items = recommendations.items;

  const [selectedRank, setSelectedRank] = useState(items[0]?.rank ?? 0);

  if (items.length === 0) return null;

  const selected =
    items.find((item) => item.rank === selectedRank) ?? items[0]!;

  return (
    <MSCard
      className={styles.scanSectionCard}
      title="Recommended actions"
      padding={true}
      data-prominence="recommendations"
    >
      <div className={styles.recommendationLayout}>
        <nav className={styles.actionRail} aria-label="Recommended actions">
          <p className={styles.actionRailHint}>{detailCopy.selectPrompt}</p>
          <ol className={styles.actionRailList}>
            {items.map((item) => {
              const isSelected = item.rank === selected.rank;
              return (
                <li key={item.rank} className={styles.actionRailItem}>
                  <button
                    type="button"
                    className={[
                      styles.actionRailButton,
                      isSelected ? styles.actionRailButtonSelected : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-selected={isSelected}
                    onClick={() => setSelectedRank(item.rank)}
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
          key={selected.rank}
        >
          {selected.rationale ? (
            <div className={styles.detailBlock}>
              <h3 className={styles.sectionSubheading}>
                {detailCopy.whyLabel}
              </h3>
              <p className={styles.sectionBody}>{selected.rationale}</p>
            </div>
          ) : (
            <MSCardMuted as="p">{detailCopy.selectPrompt}</MSCardMuted>
          )}
        </div>
      </div>
    </MSCard>
  );
}
