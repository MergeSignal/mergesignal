export class EngineAbiTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly phase: string;

  constructor(timeoutMs: number, phase: string) {
    super(`Engine ABI validation timed out after ${timeoutMs}ms (${phase})`);
    this.name = "EngineAbiTimeoutError";
    this.timeoutMs = timeoutMs;
    this.phase = phase;
  }
}

export function defaultEngineStartupTimeoutMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.MERGESIGNAL_ENGINE_STARTUP_TIMEOUT_MS ?? "30000";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 30_000;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  phase: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new EngineAbiTimeoutError(timeoutMs, phase));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
