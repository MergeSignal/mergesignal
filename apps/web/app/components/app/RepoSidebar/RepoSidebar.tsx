"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Repo } from "../../../api/app/repos/route";
import styles from "./RepoSidebar.module.css";

type Props = {
  owner: string;
};

/**
 * Sidebar listing repositories for the current owner.
 * Fetches from /api/app/repos on mount and when owner changes.
 * Active repo is derived from the current pathname.
 */
export function RepoSidebar({ owner }: Props) {
  const pathname = usePathname();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Derive active repo from pathname: /app/:owner/:repo
  const segments = pathname.split("/").filter(Boolean);
  const activeRepo = segments[2] ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/app/repos?org=${encodeURIComponent(owner)}`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json() as Promise<{ repos: Repo[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setRepos(data.repos);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [owner]);

  return (
    <aside className={styles.sidebar}>
      <p className={styles.ownerLabel}>{owner}</p>
      {loading ? (
        <div className={styles.loadingList}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : error ? (
        <p className={styles.errorMsg}>Could not load repositories.</p>
      ) : repos.length === 0 ? (
        <p className={styles.emptyMsg}>No repositories found.</p>
      ) : (
        <ul className={styles.list}>
          {repos.map((repo) => {
            const isActive = repo.name === activeRepo;
            return (
              <li key={repo.fullName}>
                <Link
                  href={`/app/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`}
                  className={`${styles.repoLink} ${isActive ? styles.active : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className={styles.repoName}>{repo.name}</span>
                  {repo.private ? (
                    <span className={styles.privateBadge}>private</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
