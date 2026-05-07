import styles from "./loading.module.css";

export default function RepoOverviewLoading() {
  return (
    <div className={styles.skeleton}>
      {/* Mimics ShellTitlebar */}
      <div className={`${styles.bar} ${styles.titleBar}`} />

      {/* Score + meta row */}
      <div className={styles.topRow}>
        <div className={`${styles.bar} ${styles.score}`} />
        <div className={styles.badgeRow}>
          <div className={`${styles.bar} ${styles.badge}`} />
          <div className={`${styles.bar} ${styles.badge}`} />
        </div>
      </div>

      {/* Alert cards */}
      <div className={styles.alertRow}>
        <div className={`${styles.bar} ${styles.alertCard}`} />
        <div className={`${styles.bar} ${styles.alertCard}`} />
        <div className={`${styles.bar} ${styles.alertCard}`} />
      </div>

      {/* Layer rows */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`${styles.bar} ${styles.layerRow}`} />
      ))}
    </div>
  );
}
