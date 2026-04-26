"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import styles from "./UserNav.module.css";

export function UserNav({
  linkedOwner,
}: {
  /** GitHub owner for this deployment (optional hint for dashboard link). */
  linkedOwner?: string;
}) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className={styles.muted}>…</span>;
  }

  if (!session) {
    return (
      <button
        type="button"
        className={styles.button}
        onClick={() => void signIn("github")}
      >
        Sign in with GitHub
      </button>
    );
  }

  return (
    <div className={styles.wrap}>
      {linkedOwner ? (
        <Link
          className={styles.navLink}
          href={`/org/${encodeURIComponent(linkedOwner)}`}
        >
          Dashboard
        </Link>
      ) : null}
      <span className={styles.user}>
        {session.user?.name ?? session.githubLogin ?? "Signed in"}
      </span>
      <button
        type="button"
        className={styles.buttonSecondary}
        onClick={() => void signOut({ callbackUrl: "/" })}
      >
        Sign out
      </button>
    </div>
  );
}
