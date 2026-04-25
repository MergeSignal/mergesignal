import Link from "next/link";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.disclaimer}>
          <strong>Important:</strong> MergeSignal gives{" "}
          <strong>automated, informational dependency risk insight</strong>—not
          legal advice or a full security audit. We publish how we handle data
          and what we won&apos;t do with your content in the{" "}
          <Link
            href="https://github.com/MergeSignal/mergesignal/blob/main/PRIVACY.md"
            className={styles.link}
          >
            Privacy Policy
          </Link>
          . Please <strong>validate</strong> recommendations and scores before
          material decisions (for example production deploys).
        </div>

        <div className={styles.links}>
          <Link
            href="https://github.com/MergeSignal/mergesignal"
            className={styles.link}
          >
            GitHub
          </Link>
          <span className={styles.separator}>•</span>
          <Link
            href="https://github.com/MergeSignal/mergesignal/blob/main/TERMS.md"
            className={styles.link}
          >
            Terms of Service
          </Link>
          <span className={styles.separator}>•</span>
          <Link
            href="https://github.com/MergeSignal/mergesignal/blob/main/PRIVACY.md"
            className={styles.link}
          >
            Privacy Policy
          </Link>
          <span className={styles.separator}>•</span>
          <Link
            href="https://github.com/MergeSignal/mergesignal/blob/main/API-TERMS.md"
            className={styles.link}
          >
            API Terms
          </Link>
          <span className={styles.separator}>•</span>
          <Link
            href="https://github.com/MergeSignal/mergesignal/blob/main/CONTACT.md"
            className={styles.link}
          >
            Contact
          </Link>
          <span className={styles.separator}>•</span>
          <Link
            href="https://github.com/MergeSignal/mergesignal/blob/main/LICENSE"
            className={styles.link}
          >
            Apache 2.0 License
          </Link>
        </div>

        <div className={styles.copyright}>
          © 2026 MergeSignal. All analysis is informational only. Validate all
          outputs before use.
        </div>
      </div>
    </footer>
  );
}
