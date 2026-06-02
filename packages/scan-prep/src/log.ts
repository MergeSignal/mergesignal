/** Minimal structured logging for scan-prep (no external logger dependency). */

export function logDebug(fields: Record<string, unknown>, msg: string): void {
  console.debug(JSON.stringify({ level: "debug", msg, ...fields }));
}

export function logInfo(fields: Record<string, unknown>, msg: string): void {
  console.info(JSON.stringify({ level: "info", msg, ...fields }));
}

export function logWarn(fields: Record<string, unknown>, msg: string): void {
  console.warn(JSON.stringify({ level: "warn", msg, ...fields }));
}

export function logError(fields: Record<string, unknown>, msg: string): void {
  console.error(JSON.stringify({ level: "error", msg, ...fields }));
}
