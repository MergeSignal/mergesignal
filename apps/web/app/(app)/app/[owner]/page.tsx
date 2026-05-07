import styles from "./OwnerLanding.module.css";

/**
 * `/app/:owner` — owner scope without a repository segment.
 * Scope controls live in the parent layout; this page adds orientation copy.
 */
export default async function AppOwnerLandingPage() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Choose a repository</h1>
      <p className={styles.body}>
        Pick a repository from the Account / Repository selectors above, or from
        the sidebar list.
      </p>
    </div>
  );
}
