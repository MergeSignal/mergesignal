function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientPgError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "57P01" ||
    code === "08006" ||
    code === "08003"
  ) {
    return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /timeout|Connection terminated|server closed the connection/i.test(
    msg,
  );
}

export type WithPgRetriesOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
};

/**
 * Retries transient PostgreSQL / network errors only (not constraint violations).
 */
export async function withPgRetries<T>(
  fn: () => Promise<T>,
  opts: WithPgRetriesOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 150;
  let last: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retry = attempt < maxAttempts - 1 && isTransientPgError(e);
      if (!retry) throw e;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}
