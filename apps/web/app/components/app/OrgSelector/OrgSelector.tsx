"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import styles from "./OrgSelector.module.css";

type Props = {
  githubLogin: string;
  githubOrgs: string[];
};

/**
 * Dropdown in the app header for switching between personal account and orgs.
 * On change, fetches the first available repo for the selected owner and
 * navigates to it, or falls back to /app if none are found.
 *
 * Derives the current owner from the URL (pathname) — URL is the source of truth.
 */
export function OrgSelector({ githubLogin, githubOrgs }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // pathname: /app, /app/:owner, /app/:owner/:repo
  const segments = pathname.split("/").filter(Boolean); // ["app", owner?, repo?]
  const currentOwner = segments[1] ?? githubLogin;

  const owners = [githubLogin, ...githubOrgs];

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = e.target.value;
      if (selected === currentOwner) return;

      try {
        const res = await fetch(
          `/api/app/repos?org=${encodeURIComponent(selected)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as {
            repos: Array<{ name: string; fullName: string }>;
          };
          const first = data.repos[0];
          if (first) {
            router.push(
              `/app/${encodeURIComponent(selected)}/${encodeURIComponent(first.name)}`,
            );
            return;
          }
        }
      } catch {
        // fall through to /app on any error
      }

      router.push("/app");
    },
    [currentOwner, router],
  );

  return (
    <select
      className={styles.select}
      value={currentOwner}
      onChange={handleChange}
      aria-label="Select organization or personal account"
    >
      {owners.map((o) => (
        <option key={o} value={o}>
          {o === githubLogin ? `${o} (personal)` : o}
        </option>
      ))}
    </select>
  );
}
