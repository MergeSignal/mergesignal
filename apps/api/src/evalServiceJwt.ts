/**
 * Evaluation-only: pins jsonwebtoken@8.5.1 on a real auth path for hosted PR intelligence.
 * See docs/evaluation/PR_INTELLIGENCE_EVAL_JWT.md — remove with the eval branch.
 */
import jwt from "jsonwebtoken";

export type ServiceJwtClaims = {
  owner: string;
  purpose: "scan-callback" | "internal-api";
};

const ALLOWED_ALGORITHMS: jwt.Algorithm[] = ["HS256"];

/**
 * Verifies a Bearer token issued for internal service-to-service API access.
 * Used when org API keys are not supplied but MERGESIGNAL_SERVICE_JWT_SECRET is configured.
 */
export function verifyServiceJwtBearer(
  token: string,
  secret: string,
): ServiceJwtClaims | null {
  if (!token || token.split(".").length !== 3) return null;
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ALLOWED_ALGORITHMS,
      issuer: "mergesignal-api",
      audience: "mergesignal-internal",
    });
    if (!decoded || typeof decoded !== "object") return null;
    const payload = decoded as jwt.JwtPayload;
    const owner = String(payload.owner ?? payload.sub ?? "").trim();
    const purpose = payload.purpose as ServiceJwtClaims["purpose"] | undefined;
    if (!owner) return null;
    if (purpose !== "scan-callback" && purpose !== "internal-api") return null;
    return { owner, purpose };
  } catch {
    return null;
  }
}

/**
 * Signs a short-lived internal token (worker/callback paths in hosted stacks).
 */
export function signServiceJwt(
  claims: ServiceJwtClaims,
  secret: string,
  expiresInSeconds = 900,
): string {
  return jwt.sign(
    {
      owner: claims.owner,
      purpose: claims.purpose,
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: expiresInSeconds,
      issuer: "mergesignal-api",
      audience: "mergesignal-internal",
    },
  );
}

/**
 * Cold-start import of jsonwebtoken verify/sign on the API entrypoint (reachable at runtime).
 */
export function evalTouchJwtLibraryAtStartup(secret: string): void {
  const token = signServiceJwt(
    { owner: "eval-startup", purpose: "scan-callback" },
    secret,
    300,
  );
  const claims = verifyServiceJwtBearer(token, secret);
  if (!claims || claims.owner !== "eval-startup") {
    throw new Error("eval: jwt startup self-check failed");
  }
}
