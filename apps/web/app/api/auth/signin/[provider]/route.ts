import { handlers, signIn } from "../../../../../auth";
import {
  AuthLogEvent,
  SUPPORTED_AUTH_PROVIDERS,
  logAuthEvent,
  sanitizeRedirectTo,
} from "../../../../../lib/auth";
import type { SupportedAuthProvider } from "../../../../../lib/auth/constants";

// next-auth/react signIn() POSTs here; delegate to Auth.js catch-all handler.
export const { POST } = handlers;

function isSupportedProvider(
  provider: string,
): provider is SupportedAuthProvider {
  return (SUPPORTED_AUTH_PROVIDERS as readonly string[]).includes(provider);
}

function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: string }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function isAuthFailure(err: unknown): err is { type: string; message: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    typeof (err as { type?: unknown }).type === "string"
  );
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;

  if (!isSupportedProvider(provider)) {
    return new Response("Invalid auth provider", { status: 400 });
  }

  const url = new URL(req.url);
  const rawRedirect = url.searchParams.get("redirectTo");
  const redirectTo = sanitizeRedirectTo(rawRedirect ?? undefined);

  logAuthEvent(AuthLogEvent.SignInInitiated, {
    provider,
    redirectTo,
    pathname: url.pathname,
  });

  try {
    await signIn(provider, { redirectTo });
    return new Response(null, { status: 204 });
  } catch (err) {
    if (isNextRedirect(err)) {
      throw err;
    }
    if (isAuthFailure(err)) {
      logAuthEvent(AuthLogEvent.SignInFailed, {
        provider,
        redirectTo,
        errorType: err.type,
        error: err.message,
      });
      return new Response("Sign-in failed", { status: 500 });
    }
    throw err;
  }
}
