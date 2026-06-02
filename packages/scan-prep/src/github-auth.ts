import { createAppAuth } from "@octokit/auth-app";

import { logDebug, logError, logInfo } from "./log.js";

interface TokenCacheEntry {
  token: string;
  expiresAt: Date;
}

const tokenCache = new Map<number, TokenCacheEntry>();

export async function getInstallationToken(
  installationId: number,
): Promise<string> {
  const cached = tokenCache.get(installationId);
  const bufferMs = 5 * 60 * 1000;

  if (cached && cached.expiresAt > new Date(Date.now() + bufferMs)) {
    logDebug({ installationId }, "Using cached GitHub App token");
    return cached.token;
  }

  const appId = parseInt(process.env.GITHUB_APP_ID || "0", 10);
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!appId || !privateKey) {
    throw new Error(
      "GitHub App credentials not configured. Set GITHUB_APP_ID and GITHUB_PRIVATE_KEY environment variables.",
    );
  }

  logInfo(
    { installationId, appId },
    "Generating GitHub App installation token",
  );

  try {
    const auth = createAppAuth({ appId, privateKey });
    const result = await auth({ type: "installation", installationId });

    tokenCache.set(installationId, {
      token: result.token,
      expiresAt: new Date(result.expiresAt),
    });

    logInfo(
      { installationId, expiresAt: result.expiresAt },
      "Successfully generated GitHub App installation token",
    );

    return result.token;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logError(
      { error: message, installationId },
      "Failed to generate GitHub App installation token",
    );
    throw new Error(`Failed to authenticate with GitHub App: ${message}`);
  }
}

export function clearTokenCache(installationId?: number): void {
  if (installationId !== undefined) {
    tokenCache.delete(installationId);
  } else {
    tokenCache.clear();
  }
}
