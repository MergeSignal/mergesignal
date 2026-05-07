"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Repo } from "../../../api/app/repos/route";

type RepoListFetchResult =
  | { kind: "success"; repos: Repo[] }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "http"; status: number }
  | { kind: "network" };

/**
 * One in-flight request per (owner, refetch generation). React Strict Mode and
 * some navigations run the effect twice with the same deps; sharing the promise
 * avoids a duplicate fetch where the first would be aborted in cleanup.
 */
const inflightRepoListByKey = new Map<string, Promise<RepoListFetchResult>>();

async function fetchRepoListForOwner(
  ownerKey: string,
): Promise<RepoListFetchResult> {
  try {
    const res = await fetch(
      `/api/app/repos?org=${encodeURIComponent(ownerKey)}`,
    );
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 403) return { kind: "forbidden" };
    if (!res.ok) return { kind: "http", status: res.status };
    const json = (await res.json()) as { repos: Repo[] };
    return { kind: "success", repos: json.repos };
  } catch {
    return { kind: "network" };
  }
}

export type GithubReposLoadStatus = "idle" | "loading" | "success" | "error";

export type GithubScopeContextValue = {
  ownerKey: string | null;
  repos: Repo[];
  status: GithubReposLoadStatus;
  errorMessage: string | null;
  isUnauthorized: boolean;
  refetch: () => void;
};

const GithubScopeContext = createContext<GithubScopeContextValue | null>(null);

export function useGithubScope(): GithubScopeContextValue {
  const ctx = useContext(GithubScopeContext);
  if (!ctx) {
    throw new Error("useGithubScope must be used within GithubScopeProvider");
  }
  return ctx;
}

export function GithubScopeProvider({
  ownerKey,
  children,
}: {
  ownerKey: string | null;
  children: React.ReactNode;
}) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [status, setStatus] = useState<GithubReposLoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [refetchCount, setRefetchCount] = useState(0);

  const refetch = useCallback(() => {
    setRefetchCount((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!ownerKey) {
      setRepos([]);
      setStatus("idle");
      setErrorMessage(null);
      setIsUnauthorized(false);
      return;
    }

    setRepos([]);
    setStatus("loading");
    setErrorMessage(null);
    setIsUnauthorized(false);

    const cacheKey = `${ownerKey}:${refetchCount}`;
    let cancelled = false;

    let p = inflightRepoListByKey.get(cacheKey);
    if (!p) {
      p = fetchRepoListForOwner(ownerKey).finally(() => {
        inflightRepoListByKey.delete(cacheKey);
      });
      inflightRepoListByKey.set(cacheKey, p);
    }

    p.then((result) => {
      if (cancelled) return;
      switch (result.kind) {
        case "success":
          setRepos(result.repos);
          setStatus("success");
          setIsUnauthorized(false);
          setErrorMessage(null);
          return;
        case "unauthorized":
          setIsUnauthorized(true);
          setErrorMessage("Session expired. Sign in again.");
          setStatus("error");
          setRepos([]);
          return;
        case "forbidden":
          setErrorMessage("You do not have access to this account scope.");
          setStatus("error");
          setRepos([]);
          setIsUnauthorized(false);
          return;
        case "http":
          setErrorMessage(`Could not load repositories (${result.status}).`);
          setStatus("error");
          setRepos([]);
          setIsUnauthorized(false);
          return;
        case "network":
          setErrorMessage("Could not load repositories.");
          setStatus("error");
          setRepos([]);
          setIsUnauthorized(false);
          return;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ownerKey, refetchCount]);

  const value = useMemo(
    (): GithubScopeContextValue => ({
      ownerKey,
      repos,
      status,
      errorMessage,
      isUnauthorized,
      refetch,
    }),
    [ownerKey, repos, status, errorMessage, isUnauthorized, refetch],
  );

  return (
    <GithubScopeContext.Provider value={value}>
      {children}
    </GithubScopeContext.Provider>
  );
}
