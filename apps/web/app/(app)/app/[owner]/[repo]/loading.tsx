import styles from "./loading.module.css";

export default function RepoOverviewLoading() {
  return (
    <div className={styles.skeleton}>
      <div className={`${styles.bar} ${styles.titleBar}`} />

      <div className={styles.summaryStrip}>
        <div className={`${styles.bar} ${styles.stripStat}`} />
        <div className={`${styles.bar} ${styles.stripStat}`} />
        <div className={`${styles.bar} ${styles.stripBadge}`} />
        <div className={`${styles.bar} ${styles.stripBadge}`} />
      </div>

      <div className={styles.cardGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.prCard}>
            <div className={styles.prCardInner}>
              <div className={`${styles.bar} ${styles.prMeta}`} />
              <div className={styles.outcomeFlow}>
                <div className={styles.outcomeRowSkeleton}>
                  <div className={`${styles.bar} ${styles.outcomeBar}`} />
                  <div className={`${styles.bar} ${styles.scoreBar}`} />
                </div>
                <div className={`${styles.bar} ${styles.whyBar}`} />
              </div>
              <div className={styles.footerRow}>
                <div className={`${styles.bar} ${styles.actionBar}`} />
                <div className={`${styles.bar} ${styles.timestampBar}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
