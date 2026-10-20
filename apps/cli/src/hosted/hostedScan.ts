import {
  observeLocalGit,
  readLocalObject,
  type LocalChangedPath,
  type LocalGitFailureOutcome,
  type LocalGitObservation,
  type LocalLockfileFact,
  type LocalRawObjectRead,
} from "@mergesignal/local-git";
import type { ScanResult } from "@mergesignal/shared";

import { resolveApiOrigin } from "./apiOrigin.js";
import {
  createHostedScanClient,
  isTransientHostedFailure,
  type HostedRequestFailure,
  type HostedScanClient,
  type LocalScanSubmission,
} from "./client.js";

/** Worker wait, starting when the pending object request is opened. */
const SERVER_FULFILLMENT_WINDOW_MS = 20_000;
/**
 * Worker acquisition wait slice. The client deadline ends one slice before
 * the nominal 20s close instead of on that same instant.
 */
const SAFETY_MARGIN_MS = 100;
/** CLI-4 local Git command bound. Type, size, and payload share this cap. */
const LOCAL_GIT_READ_BUDGET_MS = 15_000;
const POLL_INTERVAL_MS = 1_000;
/** Existing stale-scan horizon for a terminal hosted result. */
const SCAN_WAIT_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_TRANSIENT_POLLS = 3;

type Clock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};

type HostedScanFailure =
  | HostedRequestFailure
  | { code: "missing_api_key" }
  | { code: "scan_failed"; detail: string | null }
  | { code: "scan_timed_out" }
  | { code: "object_unavailable" }
  | { code: "object_oversized"; size: number }
  | { code: "object_unsupported" }
  | { code: "git_unavailable" }
  | { code: "fulfillment_expired" };

type HostedScanPipelineResult =
  | {
      ok: true;
      kind: "local";
      observation: Extract<
        LocalGitObservation,
        {
          ok: true;
          outcome:
            | "no_supported_dependency_change"
            | "no_dependency_upgrade_episode";
        }
      >;
    }
  | { ok: false; kind: "local"; outcome: LocalGitFailureOutcome }
  | { ok: true; kind: "scan"; scanId: string; result: ScanResult }
  | { ok: false; kind: "hosted"; failure: HostedScanFailure };

type RunHostedLocalScanInput = {
  cwd: string;
  base?: string;
  gitBinary?: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  clock?: Clock;
  readObject?: typeof readLocalObject;
};

const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export async function runHostedLocalScan(
  input: RunHostedLocalScanInput,
): Promise<HostedScanPipelineResult> {
  const observed = await observeLocalGit({
    cwd: input.cwd,
    base: input.base,
    gitBinary: input.gitBinary,
  });
  if (!observed.ok)
    return { ok: false, kind: "local", outcome: observed.outcome };
  if (observed.outcome !== "ready") {
    return { ok: true, kind: "local", observation: observed };
  }

  const endpoint = hostedEndpoint(input.env);
  const apiKey = endpoint.apiKey;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return { ok: false, kind: "hosted", failure: { code: "missing_api_key" } };
  }
  const origin = resolveApiOrigin(endpoint.origin);
  if (!origin.ok) {
    return { ok: false, kind: "hosted", failure: { code: "invalid_origin" } };
  }

  const client = createHostedScanClient({
    origin: origin.origin,
    apiKey,
    fetchImpl: input.fetchImpl,
  });
  const clock = input.clock ?? systemClock;
  const pendingCouldOpenAt = clock.now();
  const submitted = await client.submit(localScanBody(observed));
  if (!submitted.ok)
    return { ok: false, kind: "hosted", failure: submitted.failure };

  return pollUntilDone({
    client,
    scanId: submitted.scanId,
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    clock,
    readObject: input.readObject ?? readLocalObject,
    pendingCouldOpenAt,
  });
}

async function pollUntilDone(input: {
  client: HostedScanClient;
  scanId: string;
  cwd: string;
  gitBinary?: string;
  clock: Clock;
  readObject: typeof readLocalObject;
  pendingCouldOpenAt: number;
}): Promise<HostedScanPipelineResult> {
  const deadline = input.clock.now() + SCAN_WAIT_MS;
  let pendingCouldOpenAt = input.pendingCouldOpenAt;
  let transientPolls = 0;

  while (input.clock.now() < deadline) {
    const pollStarted = input.clock.now();
    const polled = await input.client.poll(input.scanId);
    if (!polled.ok) {
      transientPolls += 1;
      if (
        isTransientHostedFailure(polled.failure) &&
        transientPolls < MAX_CONSECUTIVE_TRANSIENT_POLLS
      ) {
        await input.clock.sleep(POLL_INTERVAL_MS);
        continue;
      }
      return { ok: false, kind: "hosted", failure: polled.failure };
    }
    transientPolls = 0;
    if (polled.state === "done") {
      return {
        ok: true,
        kind: "scan",
        scanId: input.scanId,
        result: polled.result,
      };
    }
    if (polled.state === "not_pending") {
      pendingCouldOpenAt = pollStarted;
      await input.clock.sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (polled.state === "unknown") {
      await input.clock.sleep(POLL_INTERVAL_MS);
      continue;
    }
    const fulfilled = await fulfillPending({
      client: input.client,
      scanId: input.scanId,
      cwd: input.cwd,
      gitBinary: input.gitBinary,
      objectId: polled.objectId,
      generation: polled.generation,
      clock: input.clock,
      readObject: input.readObject,
      deadline:
        pendingCouldOpenAt + SERVER_FULFILLMENT_WINDOW_MS - SAFETY_MARGIN_MS,
    });
    if ("code" in fulfilled) {
      return { ok: false, kind: "hosted", failure: fulfilled };
    }
    if (fulfilled.anchorAt !== undefined) {
      pendingCouldOpenAt = fulfilled.anchorAt;
    } else {
      await input.clock.sleep(POLL_INTERVAL_MS);
    }
  }

  return { ok: false, kind: "hosted", failure: { code: "scan_timed_out" } };
}

async function fulfillPending(input: {
  client: HostedScanClient;
  scanId: string;
  cwd: string;
  gitBinary?: string;
  objectId: string;
  generation: string;
  clock: Clock;
  readObject: typeof readLocalObject;
  deadline: number;
}): Promise<{ anchorAt?: number } | HostedScanFailure> {
  const gitBudget = Math.min(
    LOCAL_GIT_READ_BUDGET_MS,
    input.deadline - input.clock.now(),
  );
  if (gitBudget <= 0) return { code: "fulfillment_expired" };

  const read = await input.readObject({
    cwd: input.cwd,
    gitBinary: input.gitBinary,
    objectId: input.objectId,
    timeoutMs: gitBudget,
  });
  const failure = objectFailure(read);
  if (failure) return failure;
  if (read.kind !== "bytes") return { code: "object_unavailable" };

  const uploadBudget = input.deadline - input.clock.now();
  if (uploadBudget <= 0) return { code: "fulfillment_expired" };
  const uploadStarted = input.clock.now();
  const uploaded = await input.client.fulfill({
    scanId: input.scanId,
    objectId: input.objectId,
    generation: input.generation,
    bytes: read.bytes,
    timeoutMs: uploadBudget,
  });
  if (uploaded.ok) return { anchorAt: uploadStarted };
  if (uploaded.settled) return {};
  return uploaded.failure;
}

function objectFailure(read: LocalRawObjectRead): HostedScanFailure | null {
  if (read.kind === "bytes") return null;
  if (read.kind === "oversized")
    return { code: "object_oversized", size: read.size };
  if (read.kind === "unsupported_type") return { code: "object_unsupported" };
  if (read.kind === "git_unavailable") return { code: "git_unavailable" };
  return { code: "object_unavailable" };
}

function localScanBody(
  observation: Extract<LocalGitObservation, { outcome: "ready" }>,
): LocalScanSubmission {
  const head = lockfileSide(observation.lockfile, "head");
  const base = lockfileSide(observation.lockfile, "base");
  const changedPaths = flattenChangedPaths(observation.changedPaths);
  return {
    local: {
      changeIntent: "change_request",
      headRevision: { sha: observation.headCommit },
      baseRevision: { sha: observation.baseCommit },
      ...(changedPaths.length > 0 ? { changedPaths } : {}),
      ...(head ? { lockfileAtHead: head } : {}),
      ...(base ? { lockfileAtBase: base } : {}),
    },
  };
}

function lockfileSide(
  fact: LocalLockfileFact,
  side: "head" | "base",
): LocalScanSubmission["local"]["lockfileAtHead"] {
  if (fact.availability !== "compared") return undefined;
  const content = side === "head" ? fact.headContent : fact.baseContent;
  if (content === undefined) return undefined;
  return { manager: fact.manager, content, path: fact.path };
}

function hostedEndpoint(env: NodeJS.ProcessEnv | undefined): {
  apiKey: string | undefined;
  origin: string | undefined;
} {
  if (env) {
    return {
      apiKey: env.MERGESIGNAL_API_KEY,
      origin: env.MERGESIGNAL_API_ORIGIN,
    };
  }
  return {
    apiKey: process.env.MERGESIGNAL_API_KEY,
    origin: process.env.MERGESIGNAL_API_ORIGIN,
  };
}

function flattenChangedPaths(changes: readonly LocalChangedPath[]): string[] {
  const paths: string[] = [];
  for (const change of changes) {
    if (change.status === "renamed") {
      paths.push(change.from, change.to);
    } else {
      paths.push(change.path);
    }
  }
  return paths;
}
