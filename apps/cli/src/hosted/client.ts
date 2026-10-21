import type { ScanResult } from "@mergesignal/shared";

import { isBearerDestination } from "./apiOrigin.js";

const RESPONSE_BYTE_LIMIT = 4 * 1024 * 1024;
const HTTP_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Poll GET bound. Together with the one-second poll interval this is the
 * five-second discovery allowance inside the server's 20-second fulfillment window.
 */
export const POLL_GET_TIMEOUT_MS = 4_000;

export type HostedRequestFailure =
  | { code: "invalid_origin" }
  | { code: "unauthorized" }
  | { code: "forbidden" }
  | { code: "bad_request" }
  | { code: "not_found" }
  | { code: "payload_too_large" }
  | {
      code: "entitlement_exhausted";
      limit: number;
      used: number;
      resetsAt: string;
    }
  | { code: "transient" }
  | { code: "invalid_response" };

export type LocalScanSubmission = {
  local: {
    changeIntent: "change_request";
    headRevision: { sha: string };
    baseRevision: { sha: string };
    changedPaths?: string[];
    lockfileAtHead?: {
      manager: "pnpm" | "npm" | "yarn";
      content: string;
      path?: string;
    };
    lockfileAtBase?: {
      manager: "pnpm" | "npm" | "yarn";
      content: string;
      path?: string;
    };
  };
};

export type SubmitScanResult =
  | { ok: true; scanId: string }
  | { ok: false; failure: HostedRequestFailure };

export type PollScanResult =
  | {
      ok: true;
      state: "pending";
      objectId: string;
      generation: string;
    }
  | { ok: true; state: "not_pending" }
  | { ok: true; state: "unknown" }
  | { ok: true; state: "done"; result: ScanResult }
  | {
      ok: false;
      failure:
        | HostedRequestFailure
        | { code: "scan_failed"; detail: string | null };
    };

export type FulfillObjectResult =
  | { ok: true }
  | { ok: false; settled: true }
  | { ok: false; settled: false; failure: HostedRequestFailure };

export type RetrieveScanResult =
  | { ok: true; result: ScanResult }
  | {
      ok: false;
      failure:
        | HostedRequestFailure
        | { code: "scan_failed"; detail: string | null }
        | { code: "scan_queued" }
        | { code: "scan_running" };
    };

export type HostedScanClient = {
  submit(body: LocalScanSubmission): Promise<SubmitScanResult>;
  poll(scanId: string): Promise<PollScanResult>;
  fulfill(input: {
    scanId: string;
    objectId: string;
    generation: string;
    bytes: Uint8Array;
    timeoutMs: number;
  }): Promise<FulfillObjectResult>;
  retrieve(scanId: string): Promise<RetrieveScanResult>;
};

const SCAN_ID = /^[A-Za-z0-9_-]{1,128}$/;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const GENERATION = /^[A-Za-z0-9._:-]{1,128}$/;

export function createHostedScanClient(input: {
  origin: URL;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): HostedScanClient {
  const fetchImpl = input.fetchImpl ?? fetch;
  const allowed = isBearerDestination(input.origin);

  async function request(
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<
    | { ok: true; status: number; bytes: Uint8Array }
    | { ok: false; failure: HostedRequestFailure }
  > {
    if (!allowed) return { ok: false, failure: { code: "invalid_origin" } };
    const url = new URL(path, input.origin);
    if (url.origin !== input.origin.origin) {
      return { ok: false, failure: { code: "invalid_origin" } };
    }
    try {
      const response = await fetchImpl(url, {
        ...init,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          ...init.headers,
          authorization: `Bearer ${input.apiKey}`,
        },
      });
      const bytes = await readBounded(response, RESPONSE_BYTE_LIMIT);
      if (bytes === null) {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      return { ok: true, status: response.status, bytes };
    } catch {
      return { ok: false, failure: { code: "transient" } };
    }
  }

  return {
    async submit(body) {
      const response = await request(
        "/v1/scan",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        HTTP_REQUEST_TIMEOUT_MS,
      );
      if (!response.ok) return response;
      if (response.status !== 202) {
        return {
          ok: false,
          failure: classifyFailure(response.status, response.bytes),
        };
      }
      const parsed = parseJson(response.bytes);
      if (!isRecord(parsed) || typeof parsed.scanId !== "string") {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      if (!SCAN_ID.test(parsed.scanId)) {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      return { ok: true, scanId: parsed.scanId };
    },

    async poll(scanId) {
      if (!SCAN_ID.test(scanId)) {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      const response = await request(
        `/v1/scan/${scanId}?include=rawResult`,
        { method: "GET" },
        POLL_GET_TIMEOUT_MS,
      );
      if (!response.ok) return response;
      if (response.status !== 200) {
        return {
          ok: false,
          failure: classifyFailure(response.status, response.bytes),
        };
      }
      const parsed = parseJson(response.bytes);
      if (!isRecord(parsed) || typeof parsed.status !== "string") {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      if (parsed.status === "failed") {
        return {
          ok: false,
          failure: {
            code: "scan_failed",
            detail: typeof parsed.error === "string" ? parsed.error : null,
          },
        };
      }
      if (parsed.status === "done") {
        if (!isScanResult(parsed.result)) {
          return { ok: false, failure: { code: "invalid_response" } };
        }
        return { ok: true, state: "done", result: parsed.result };
      }
      if (parsed.status !== "queued" && parsed.status !== "running") {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      const acquisition = readAcquisition(parsed.acquisition);
      if (acquisition === "invalid") {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      if (acquisition === "unknown") return { ok: true, state: "unknown" };
      if (acquisition === "not_pending") {
        return { ok: true, state: "not_pending" };
      }
      return { ok: true, state: "pending", ...acquisition };
    },

    async fulfill(requestInput) {
      if (
        !SCAN_ID.test(requestInput.scanId) ||
        !OBJECT_ID.test(requestInput.objectId) ||
        !GENERATION.test(requestInput.generation) ||
        requestInput.timeoutMs <= 0
      ) {
        return {
          ok: false,
          settled: false,
          failure: { code: "invalid_response" },
        };
      }
      const response = await request(
        `/v1/scan/${requestInput.scanId}/object`,
        {
          method: "POST",
          headers: {
            "content-type": "application/octet-stream",
            "x-mergesignal-object-id": requestInput.objectId,
            "x-mergesignal-acquisition-generation": requestInput.generation,
          },
          body: rawBody(requestInput.bytes),
        },
        requestInput.timeoutMs,
      );
      if (!response.ok)
        return { ok: false, settled: false, failure: response.failure };
      if (response.status === 204) return { ok: true };
      if (response.status === 409) return { ok: false, settled: true };
      return {
        ok: false,
        settled: false,
        failure: classifyFailure(response.status, response.bytes),
      };
    },

    async retrieve(scanId) {
      if (!SCAN_ID.test(scanId)) {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      const response = await request(
        `/v1/scan/${scanId}?include=rawResult`,
        { method: "GET" },
        HTTP_REQUEST_TIMEOUT_MS,
      );
      if (!response.ok) return { ok: false, failure: response.failure };
      if (response.status !== 200) {
        return {
          ok: false,
          failure: classifyFailure(response.status, response.bytes),
        };
      }
      const parsed = parseJson(response.bytes);
      if (!isRecord(parsed) || typeof parsed.status !== "string") {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      if (parsed.status === "failed") {
        return {
          ok: false,
          failure: {
            code: "scan_failed",
            detail: typeof parsed.error === "string" ? parsed.error : null,
          },
        };
      }
      if (parsed.status === "queued") {
        return { ok: false, failure: { code: "scan_queued" } };
      }
      if (parsed.status === "running") {
        return { ok: false, failure: { code: "scan_running" } };
      }
      if (parsed.status !== "done" || !isScanResult(parsed.result)) {
        return { ok: false, failure: { code: "invalid_response" } };
      }
      return { ok: true, result: parsed.result };
    },
  };
}

export function isTransientHostedFailure(
  failure:
    | HostedRequestFailure
    | { code: "scan_failed"; detail: string | null },
): boolean {
  return failure.code === "transient";
}

function classifyFailure(
  status: number,
  bytes: Uint8Array,
): HostedRequestFailure {
  if (status === 401) return { code: "unauthorized" };
  if (status === 403) return { code: "forbidden" };
  if (status === 400) return { code: "bad_request" };
  if (status === 404) return { code: "not_found" };
  if (status === 413) return { code: "payload_too_large" };
  if (status === 429) {
    const body = parseJson(bytes);
    if (isRecord(body) && body.code === "entitlement_exhausted") {
      return entitlementExhausted(body) ?? { code: "invalid_response" };
    }
    return { code: "transient" };
  }
  if (status === 408 || status >= 500) return { code: "transient" };
  return { code: "invalid_response" };
}

function entitlementExhausted(
  body: unknown,
): Extract<HostedRequestFailure, { code: "entitlement_exhausted" }> | null {
  if (!isRecord(body) || body.code !== "entitlement_exhausted") return null;
  if (
    typeof body.limit !== "number" ||
    typeof body.used !== "number" ||
    typeof body.resetsAt !== "string"
  ) {
    return null;
  }
  return {
    code: "entitlement_exhausted",
    limit: body.limit,
    used: body.used,
    resetsAt: body.resetsAt,
  };
}

function readAcquisition(
  value: unknown,
):
  | { objectId: string; generation: string }
  | "not_pending"
  | "unknown"
  | "invalid" {
  if (value === undefined) return "unknown";
  if (!isRecord(value) || typeof value.pending !== "boolean") return "invalid";
  if (value.pending === false) return "not_pending";
  if (
    typeof value.objectId !== "string" ||
    typeof value.generation !== "string"
  ) {
    return "invalid";
  }
  const objectId = value.objectId.toLowerCase();
  if (!OBJECT_ID.test(objectId) || !GENERATION.test(value.generation)) {
    return "invalid";
  }
  return { objectId, generation: value.generation };
}

function isScanResult(value: unknown): value is ScanResult {
  if (!isRecord(value)) return false;
  return typeof value.generatedAt === "string" && Array.isArray(value.findings);
}

function parseJson(bytes: Uint8Array): unknown {
  if (bytes.byteLength === 0) return undefined;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rawBody(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy]);
}

async function readBounded(
  response: Response,
  limit: number,
): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(step.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
