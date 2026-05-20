"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { MSSelect } from "../../shared/MSSelect/MSSelect";
import { MSTooltip } from "../../shared/MSTooltip/MSTooltip";
import { GithubScopeProvider, useGithubScope } from "./GithubScopeContext";
import {
  githubOwnerTooltipLabel,
  useGithubOwnerAccountSelectData,
} from "./useGithubOwnerAccountSelectData";
import styles from "./AppGithubScopeBar.module.css";

const REPO_HELPER_ID = "github-app-repo-scope-helper";

export function appPathSegments(pathname: string): {
  owner: string | null;
  repo: string | null;
} {
  const segs = pathname.split("/").filter(Boolean);
  if (segs[0] !== "app") return { owner: null, repo: null };
  return {
    owner: segs[1] ?? null,
    repo: segs[2] ?? null,
  };
}

type InnerProps = {
  githubLogin: string;
  githubOrgs: string[];
};

function AppGithubScopeBarInner({ githubLogin, githubOrgs }: InnerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { owner: pathOwner, repo: pathRepo } = appPathSegments(pathname);
  const loginTrim = githubLogin.trim();
  const { groupedData: ownerSelectData, flatOwnerSlugs } =
    useGithubOwnerAccountSelectData(githubLogin, githubOrgs);
  const { repos, status, errorMessage, isUnauthorized, refetch } =
    useGithubScope();

  const singleOwnerNavRef = useRef(false);
  const autoSingleRepoKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isUnauthorized) return;
    const callbackUrl =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : pathname;
    void signIn("github", { callbackUrl });
  }, [isUnauthorized, pathname]);

  useEffect(() => {
    if (flatOwnerSlugs.length !== 1) return;
    if (pathname !== "/app") return;
    if (singleOwnerNavRef.current) return;
    singleOwnerNavRef.current = true;
    router.replace(`/app/${encodeURIComponent(flatOwnerSlugs[0]!)}`);
  }, [flatOwnerSlugs, pathname, router]);

  useEffect(() => {
    if (status !== "success" || repos.length !== 1) return;
    if (!pathOwner || pathRepo) return;
    const key = `${pathOwner}:${repos[0]!.name}`;
    if (autoSingleRepoKeyRef.current === key) return;
    autoSingleRepoKeyRef.current = key;
    router.replace(
      `/app/${encodeURIComponent(pathOwner)}/${encodeURIComponent(repos[0]!.name)}`,
    );
  }, [status, repos, pathOwner, pathRepo, router]);

  const handleOwnerChange = useCallback(
    (next: string | null) => {
      if (!next) return;
      if (next === pathOwner) return;
      router.push(`/app/${encodeURIComponent(next)}`);
    },
    [pathOwner, router],
  );

  const handleRepoChange = useCallback(
    (next: string | null) => {
      if (!next || !pathOwner) return;
      if (next === pathRepo) return;
      router.push(
        `/app/${encodeURIComponent(pathOwner)}/${encodeURIComponent(next)}`,
      );
    },
    [pathOwner, pathRepo, router],
  );

  const showScopeIntro = useMemo(() => {
    if (flatOwnerSlugs.length > 1) return true;
    if (!pathOwner) return false;
    return status === "success" && repos.length > 1;
  }, [flatOwnerSlugs.length, pathOwner, status, repos.length]);

  if (flatOwnerSlugs.length === 0) {
    return (
      <p className={styles.emptyOwners} role="status">
        {!loginTrim
          ? "No GitHub account found for this session."
          : "No GitHub organizations found."}
      </p>
    );
  }

  const ownerDisabled = flatOwnerSlugs.length === 1;
  const ownerValue = pathOwner ?? null;

  const repoData = repos.map((r) => ({
    value: r.name,
    label: r.private ? `${r.name} (private)` : r.name,
  }));

  const repoLoading = Boolean(pathOwner) && status === "loading";
  const repoDisabled =
    !pathOwner ||
    repoLoading ||
    repos.length === 0 ||
    (repos.length === 1 && status === "success");
  const repoValue =
    pathRepo && repos.some((r) => r.name === pathRepo) ? pathRepo : null;

  const repoFieldError =
    status === "error" && errorMessage && !isUnauthorized
      ? errorMessage
      : status === "success" && pathOwner && repos.length === 0
        ? "No repositories found."
        : undefined;

  const busy = Boolean(pathOwner) && status === "loading";

  const showOrgEmptyHint =
    Boolean(pathOwner) &&
    loginTrim.length > 0 &&
    pathOwner !== loginTrim &&
    status === "success" &&
    repos.length === 0;

  return (
    <div
      className={styles.shell}
      aria-busy={busy || undefined}
      data-testid="github-scope-bar"
    >
      {showScopeIntro ? (
        <p className={styles.scopeIntro}>
          Choose your GitHub <strong>Account</strong> (personal or
          organization), then pick a <strong>Repository</strong> to open its
          dashboard.
        </p>
      ) : null}
      <div className={styles.selectWrap}>
        <MSTooltip
          label={
            ownerValue ? githubOwnerTooltipLabel(githubLogin, ownerValue) : ""
          }
          position="bottom"
          events={{ hover: true, focus: true, touch: false }}
        >
          <MSSelect
            label="Account"
            data={ownerSelectData}
            value={ownerValue}
            onChange={handleOwnerChange}
            disabled={ownerDisabled}
            placeholder="Select account"
            truncateSelection
            aria-label="GitHub account or organization"
          />
        </MSTooltip>
      </div>
      <div className={styles.selectWrap}>
        <p id={REPO_HELPER_ID} className={styles.helper}>
          Repositories for the selected account.
        </p>
        {repoLoading ? (
          <div className={styles.repoLoadingStrip} aria-hidden="true">
            <div className={styles.skeleton} />
          </div>
        ) : null}
        <MSTooltip
          label={
            repoValue
              ? (repoData.find((r) => r.value === repoValue)?.label ??
                repoValue)
              : ""
          }
          position="bottom"
          events={{ hover: true, focus: true, touch: false }}
        >
          <MSSelect
            label="Repository"
            data={repoData}
            value={repoValue}
            onChange={handleRepoChange}
            disabled={repoDisabled}
            placeholder={
              repoLoading
                ? "Loading repositories…"
                : repos.length === 0
                  ? "No repositories found"
                  : "Select repository"
            }
            error={repoFieldError}
            truncateSelection
            aria-label="GitHub repository"
          />
        </MSTooltip>
        {status === "error" && errorMessage && !isUnauthorized ? (
          <div className={styles.retry} role="status">
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => refetch()}
            >
              Retry loading repositories
            </button>
          </div>
        ) : null}
        {showOrgEmptyHint ? (
          <p className={styles.emptyRepoHint}>
            To see this organization&apos;s repositories, grant MergeSignal
            access to <strong>{pathOwner}</strong> in your{" "}
            <a
              href="https://github.com/settings/connections/applications"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.emptyLink}
            >
              GitHub OAuth settings
            </a>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Scope selectors + navigation; must sit inside `GithubScopeProvider`. */
export function AppGithubScopeBar(props: InnerProps) {
  return <AppGithubScopeBarInner {...props} />;
}

/** `/app` home: provider has no owner key until URL gains an owner segment. */
export function AppGithubScopeHome(props: InnerProps) {
  return (
    <GithubScopeProvider ownerKey={null}>
      <AppGithubScopeBar {...props} />
    </GithubScopeProvider>
  );
}
