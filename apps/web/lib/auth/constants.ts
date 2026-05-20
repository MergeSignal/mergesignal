export const DEFAULT_AUTH_PROVIDER = "github" as const;

export const SUPPORTED_AUTH_PROVIDERS = [DEFAULT_AUTH_PROVIDER] as const;

export type SupportedAuthProvider = (typeof SUPPORTED_AUTH_PROVIDERS)[number];

export const ALLOWED_REDIRECT_PREFIXES = [
  "/app",
  "/org",
  "/scan",
  "/",
] as const;

export const DEFAULT_REDIRECT_FALLBACK = "/app";
