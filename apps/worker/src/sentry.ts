import * as Sentry from "@sentry/node";

export function initWorkerSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    environment: process.env.NODE_ENV ?? "development",
  });
}

export function captureWorkerException(error: unknown): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(error);
}
