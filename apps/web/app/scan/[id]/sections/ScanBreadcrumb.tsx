import Link from "next/link";
import styles from "../ScanDetail.module.css";

type Props = {
  owner: string;
  repo: string;
  stale?: boolean;
};

export function ScanBreadcrumb({ owner, repo, stale }: Props) {
  return (
    <nav className={styles.breadcrumb} aria-label="Scan context">
      <Link
        href={`/app/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
      >
        {owner}/{repo}
      </Link>
      {stale ? (
        <span
          className={styles.staleBadge}
          title="Scan is from an earlier commit"
        >
          stale
        </span>
      ) : null}
    </nav>
  );
}
