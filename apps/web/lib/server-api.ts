import "server-only";

import { getPublicApiBaseUrl } from "./env";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getServerApiKey(): string | undefined {
  return (
    process.env.MERGESIGNAL_API_KEY ??
    // MERGESIGNAL_DEV_API_KEY is a dev-only fallback. It must NOT use the
    // NEXT_PUBLIC_ prefix: that prefix causes Next.js to inline the value
    // into the client bundle at build time, which would expose the key.
    (process.env.NODE_ENV !== "production"
      ? process.env.MERGESIGNAL_DEV_API_KEY
      : undefined)
  );
}

export async function serverApiGet<T>(path: string): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const apiKey = getServerApiKey();
  if (!apiKey) {
    throw new ApiError(
      "Missing MERGESIGNAL_API_KEY (server-only). For local dev, MERGESIGNAL_DEV_API_KEY is also accepted when NODE_ENV is not production.",
      500,
      "Configuration error",
    );
  }

  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (err) {
    throw new ApiError(
      `API unreachable at ${url}: ${err instanceof Error ? err.message : String(err)}`,
      503,
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(
      `API request failed: ${res.status} ${res.statusText}`,
      res.status,
      text,
    );
  }

  return res.json() as Promise<T>;
}

export async function serverApiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const baseUrl = getPublicApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const apiKey = getServerApiKey();
  if (!apiKey) {
    return new Response("Missing MERGESIGNAL_API_KEY", { status: 500 });
  }
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  return fetch(url, { ...init, headers });
}
