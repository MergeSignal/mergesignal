import Link from "next/link";
import styles from "./AppShell.module.css";
import { Footer } from "./Footer";
import { UserNav } from "./UserNav";

export function AppShell({
  title,
  subtitle,
  owner,
  linkedOwner,
  children,
}: {
  title: string;
  subtitle?: string;
  owner?: string;
  /** Shown in header for quick dashboard link when signed in. */
  linkedOwner?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.brand}>
            MergeSignal
          </Link>
          {owner ? <span className={styles.owner}>/ {owner}</span> : null}
        </div>
        <nav className={styles.nav}>
          {owner ? (
            <>
              <Link
                className={styles.navLink}
                href={`/org/${encodeURIComponent(owner)}`}
              >
                Dashboard
              </Link>
              <Link
                className={styles.navLink}
                href={`/org/${encodeURIComponent(owner)}/alerts`}
              >
                Alerts
              </Link>
              <Link
                className={styles.navLink}
                href={`/org/${encodeURIComponent(owner)}/policies`}
              >
                Policies
              </Link>
              <Link
                className={styles.navLink}
                href={`/org/${encodeURIComponent(owner)}/benchmark`}
              >
                Benchmark
              </Link>
            </>
          ) : null}
          <UserNav linkedOwner={linkedOwner} />
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.titlebar}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {children}
      </main>

      <Footer />
    </div>
  );
}
