"use client";

import { AppGithubScopeBar } from "./AppGithubScopeBar";
import { GithubScopeProvider } from "./GithubScopeContext";
import styles from "./GithubAppOwnerShell.module.css";

export function GithubAppOwnerShell({
  owner,
  githubLogin,
  githubOrgs,
  children,
}: {
  owner: string;
  githubLogin: string;
  githubOrgs: string[];
  children: React.ReactNode;
}) {
  return (
    <GithubScopeProvider ownerKey={owner}>
      <div className={styles.root}>
        <AppGithubScopeBar githubLogin={githubLogin} githubOrgs={githubOrgs} />
        {children}
      </div>
    </GithubScopeProvider>
  );
}
