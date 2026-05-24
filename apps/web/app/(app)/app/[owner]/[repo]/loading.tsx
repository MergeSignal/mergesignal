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
              <div className={styles.riskBlock}>
                <div className={`${styles.bar} ${styles.riskHeadline}`} />
                <div className={`${styles.bar} ${styles.summaryLine}`} />
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
