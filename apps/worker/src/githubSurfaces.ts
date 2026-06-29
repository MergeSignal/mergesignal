import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";
import {
  buildGitHubCheckRunOutput,
  type ScanQueueGithubContext,
  type ScanResult,
} from "@mergesignal/shared";

function buildOctokit(installationId: number): Octokit {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  if (!appId || !privateKey) {
    throw new Error("github_app_credentials_missing");
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey: privateKey.replace(/\\n/g, "\n"),
      installationId,
    },
  });
}

export async function publishGitHubCheckRun(
  github: ScanQueueGithubContext,
  scanId: string,
  result: ScanResult,
): Promise<void> {
  const { owner, repo, headSha, installationId } = github;
  const { title, summary, conclusion } = buildGitHubCheckRunOutput(result, {
    scanId,
  });

  const octokit = buildOctokit(installationId);
  await octokit.rest.checks.create({
    owner,
    repo,
    name: "MergeSignal",
    head_sha: headSha,
    status: "completed",
    conclusion,
    output: { title, summary },
  });
}
