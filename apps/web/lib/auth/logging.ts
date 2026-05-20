export enum AuthLogEvent {
  MiddlewareUnauthenticated = "auth.middleware.unauthenticated",
  MiddlewareApiUnauthorized = "auth.middleware.api_unauthorized",
  SignInInitiated = "auth.signin.initiated",
  SignInInvalidRedirect = "auth.signin.invalid_redirect",
  SignInFailed = "auth.signin.failed",
  GuardUnauthenticated = "auth.guard.unauthenticated",
  JwtUpsertFailed = "auth.jwt.upsert_failed",
  SessionMissingClaims = "auth.session.missing_claims",
  SignInSuccess = "auth.signin.success",
  SignOut = "auth.signout",
}

export type AuthLogFields = {
  pathname?: string;
  redirectTo?: string;
  provider?: string;
  status?: number;
  error?: string;
  errorType?: string;
  githubLogin?: string;
  requestId?: string;
};

function logLevelForEvent(event: AuthLogEvent): "info" | "warn" | "error" {
  switch (event) {
    case AuthLogEvent.SignInInvalidRedirect:
    case AuthLogEvent.JwtUpsertFailed:
    case AuthLogEvent.SessionMissingClaims:
      return "warn";
    case AuthLogEvent.SignInFailed:
      return "error";
    default:
      return "info";
  }
}

export function logAuthEvent(
  event: AuthLogEvent | string,
  fields: AuthLogFields = {},
): void {
  const level = Object.values(AuthLogEvent).includes(event as AuthLogEvent)
    ? logLevelForEvent(event as AuthLogEvent)
    : "info";
  const line = JSON.stringify({ level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
