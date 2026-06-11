import type { ScanResult } from "../types.js";
import { buildScanPresentationBundle } from "./orchestration/buildScanPresentationBundle.js";
import { presentGitHubCheckRun } from "./presenters/presentGitHubCheckRun.js";
import { renderGitHubCheckRunMarkdown } from "./render/renderGitHubCheckRunMarkdown.js";

export type GitHubCheckRunConclusion = "success" | "neutral" | "failure";

export type GitHubCheckRunOutput = {
  /** Short title shown in the checks bar (≤72 chars). */
  title: string;
  /** Markdown summary shown in the check run detail panel (≤2000 chars). */
  summary: string;
  conclusion: GitHubCheckRunConclusion;
};

/** Default Fly web app origin when `MERGESIGNAL_WEB_URL` is unset. */
const DEFAULT_WEB_APP_ORIGIN = "https://mergesignal-web.fly.dev";

export function resolveWebAppOrigin(): string {
  const url =
    typeof process !== "undefined"
      ? process.env.MERGESIGNAL_WEB_URL?.trim()
      : undefined;
  return (url || DEFAULT_WEB_APP_ORIGIN).replace(/\/+$/, "");
}

export type BuildGitHubCheckRunOutputOptions = {
  scanId: string;
  webAppOrigin?: string;
};

/**
 * Formats GitHub Check Run output from a persisted ScanResult via Assessment presentation.
 * Presentation-only — callers own Octokit checks.create.
 */
export function buildGitHubCheckRunOutput(
  result: ScanResult,
  options: BuildGitHubCheckRunOutputOptions | string,
): GitHubCheckRunOutput {
  const scanId = typeof options === "string" ? options : options.scanId;
  const webAppOrigin =
    typeof options === "string"
      ? resolveWebAppOrigin()
      : (options.webAppOrigin ?? resolveWebAppOrigin());

  if (!result.decision) {
    throw new Error("buildGitHubCheckRunOutput requires ScanResult.decision");
  }

  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
  });
  if (!bundle) {
    throw new Error(
      "buildGitHubCheckRunOutput requires ScanResult.assessment for presentation bundle",
    );
  }

  const baseline =
    result.reportPresentation?.mode === "lightweight_pr_graph_baseline";
  const presentation = presentGitHubCheckRun(bundle, {
    scanId,
    webAppOrigin,
    baseline,
  });

  return {
    title: presentation.title,
    summary: renderGitHubCheckRunMarkdown(presentation),
    conclusion: presentation.conclusion,
  };
}
