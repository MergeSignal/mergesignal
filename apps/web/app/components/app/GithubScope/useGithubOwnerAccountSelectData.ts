"use client";

import { useMemo } from "react";

import type { MSSelectGroupSection } from "../../shared/MSSelect/MSSelect";

/** Visible group heading for the signed-in user’s GitHub login row. */
export const GITHUB_ACCOUNT_SELECT_GROUP_PERSONAL = "Personal account";

/** Visible group heading for GitHub organizations from the session. */
export const GITHUB_ACCOUNT_SELECT_GROUP_ORGS = "Organizations";

export type GithubOwnerAccountSelectModel = {
  /** Pass to `MSSelect` `data` when non-empty. */
  groupedData: MSSelectGroupSection[];
  /** Deduped owner slugs: personal first, then orgs (sorted), for navigation logic. */
  flatOwnerSlugs: string[];
};

/**
 * Builds grouped `MSSelect` data: personal account vs organizations, with no
 * duplicate values (Mantine rejects duplicate option values).
 */
export function useGithubOwnerAccountSelectData(
  githubLogin: string,
  githubOrgs: string[],
): GithubOwnerAccountSelectModel {
  return useMemo(() => {
    const login = githubLogin.trim();
    const orgSet = new Set(
      githubOrgs.filter(
        (o): o is string => typeof o === "string" && o.length > 0,
      ),
    );
    if (login) orgSet.delete(login);
    const orgSlugs = [...orgSet].sort((a, b) => a.localeCompare(b));

    const groupedData: MSSelectGroupSection[] = [];
    if (login) {
      groupedData.push({
        group: GITHUB_ACCOUNT_SELECT_GROUP_PERSONAL,
        items: [{ value: login, label: login }],
      });
    }
    if (orgSlugs.length > 0) {
      groupedData.push({
        group: GITHUB_ACCOUNT_SELECT_GROUP_ORGS,
        items: orgSlugs.map((slug) => ({ value: slug, label: slug })),
      });
    }

    const flatOwnerSlugs = login ? [login, ...orgSlugs] : [...orgSlugs];

    return { groupedData, flatOwnerSlugs };
  }, [githubLogin, githubOrgs]);
}

export function githubOwnerTooltipLabel(
  githubLogin: string,
  ownerSlug: string,
): string {
  const login = githubLogin.trim();
  return ownerSlug === login && login.length > 0
    ? `${ownerSlug} (Personal)`
    : ownerSlug;
}
