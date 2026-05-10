import styles from "./loading.module.css";

export default function RepoOverviewLoading() {
  return (
    <div className={styles.skeleton}>
      {/* Mimics ShellTitlebar */}
      <div className={`${styles.bar} ${styles.titleBar}`} />

      {/* Summary strip */}
      <div className={styles.summaryStrip}>
        <div className={`${styles.bar} ${styles.stripStat}`} />
        <div className={`${styles.bar} ${styles.stripStat}`} />
        <div className={`${styles.bar} ${styles.stripBadge}`} />
        <div className={`${styles.bar} ${styles.stripBadge}`} />
      </div>

      {/* PR card placeholders */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.prCard}>
          <div className={styles.prCardInner}>
            <div className={`${styles.bar} ${styles.prMeta}`} />
            <div className={styles.prSignalRow}>
              <div className={`${styles.bar} ${styles.badge}`} />
              <div className={`${styles.bar} ${styles.scoreBar}`} />
            </div>
            <div className={`${styles.bar} ${styles.summaryLine}`} />
            <div className={`${styles.bar} ${styles.areasLine}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
