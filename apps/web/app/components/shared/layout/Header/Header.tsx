import Image from "next/image";
import Link from "next/link";

import { BrandWordmark } from "../../BrandWordmark/BrandWordmark";
import { UserNav } from "../UserNav/UserNav";
import styles from "./Header.module.css";

export function Header({
  owner,
  /** Marketing / info-only pages: logo in header only (no auth or org nav). */
  hideHeaderNav,
  /** Shown in header for quick dashboard link when signed in. */
  linkedOwner,
}: {
  owner?: string;
  hideHeaderNav?: boolean;
  linkedOwner?: string;
}) {
  const showNav = !hideHeaderNav;

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <Link href="/" className={styles.brand}>
          <Image
            src="/mergesignal-logo.png"
            alt=""
            width={1024}
            height={680}
            className={styles.brandLogo}
            priority
          />
          <BrandWordmark />
        </Link>
        {owner ? <span className={styles.owner}>/ {owner}</span> : null}
      </div>
      {showNav ? (
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
      ) : null}
    </header>
  );
}
