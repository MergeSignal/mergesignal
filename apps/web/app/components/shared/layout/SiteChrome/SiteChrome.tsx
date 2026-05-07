import { Footer } from "../Footer/Footer";
import { Header } from "../Header/Header";
import styles from "./SiteChrome.module.css";

export function SiteChrome({
  title,
  subtitle,
  owner,
  linkedOwner,
  hideTitlebar,
  /** Marketing / info-only pages: logo in header only (no auth or org nav). */
  hideHeaderNav,
  /** Legal pages: copyright only (no footer link row). */
  footerVariant = "full",
  mainWidth = "default",
  /**
   * Optional slot rendered in the header left area in place of / owner text.
   * Used by the /app/* layout to inject the OrgSelector client component.
   */
  orgSelector,
  children,
}: {
  title: string;
  subtitle?: string;
  owner?: string;
  linkedOwner?: string;
  hideTitlebar?: boolean;
  hideHeaderNav?: boolean;
  footerVariant?: "full" | "minimal";
  mainWidth?: "default" | "wide";
  orgSelector?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <Header
        owner={owner}
        hideHeaderNav={hideHeaderNav}
        linkedOwner={linkedOwner}
        orgSelector={orgSelector}
      />

      <main
        className={
          mainWidth === "wide"
            ? `${styles.main} ${styles.mainWide}`
            : styles.main
        }
      >
        {hideTitlebar ? null : (
          <div className={styles.titlebar}>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
        )}
        {children}
      </main>

      <Footer variant={footerVariant} />
    </div>
  );
}
