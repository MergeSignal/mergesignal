type CacheEntry<T> = { expiresAt: number; value: T };

const cache = new Map<string, CacheEntry<unknown>>();

export async function fetchJsonCached<T>(
  key: string,
  url: string,
  {
    ttlMs,
    timeoutMs,
    headers,
  }: { ttlMs: number; timeoutMs: number; headers?: Record<string, string> },
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = await fetchJson<T>(url, { timeoutMs, headers });
  cache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

export async function postJsonCached<T>(
  key: string,
  url: string,
  body: unknown,
  {
    ttlMs,
    timeoutMs,
    headers,
  }: { ttlMs: number; timeoutMs: number; headers?: Record<string, string> },
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = await fetchJson<T>(url, {
    timeoutMs,
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    method: "POST",
    body: JSON.stringify(body ?? null),
  });
  cache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

export async function fetchJson<T>(
  url: string,
  {
    timeoutMs,
    headers,
    method,
    body,
  }: { timeoutMs: number; headers?: Record<string, string>; method?: string; body?: string },
): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers,
      method: method ?? "GET",
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

