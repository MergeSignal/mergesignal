import * as Sentry from "@sentry/node";

let initialized = false;

export function initApiSentry(): void {
  if (initialized || !process.env.SENTRY_DSN) return;
  initialized = true;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    environment: process.env.NODE_ENV ?? "development",
  });
}

export function captureApiException(error: unknown): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(error);
}
