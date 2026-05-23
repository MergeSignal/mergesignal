import Link from "next/link";
import styles from "./Footer.module.css";

export function Footer({ variant = "full" }: { variant?: "full" | "minimal" }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        {variant === "full" ? (
          <div className={styles.links}>
            <Link href="/getting-started" className={styles.link}>
              Getting started
            </Link>
            <span className={styles.separator}>•</span>
            <Link href="/terms" className={styles.link}>
              Terms of Service
            </Link>
            <span className={styles.separator}>•</span>
            <Link href="/privacy" className={styles.link}>
              Privacy Policy
            </Link>
            <span className={styles.separator}>•</span>
            <Link href="/api-terms" className={styles.link}>
              API Terms
            </Link>
            <span className={styles.separator}>•</span>
            <Link href="/contact" className={styles.link}>
              Contact
            </Link>
          </div>
        ) : null}

        <div className={styles.copyright}>© 2026 MergeSignal</div>
      </div>
    </footer>
  );
}
