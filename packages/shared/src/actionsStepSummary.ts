/**
 * GitHub Actions `GITHUB_STEP_SUMMARY` markdown — projection of presentation bundle.
 */
import { buildScanPresentationBundle } from "./presentation/orchestration/buildScanPresentationBundle.js";
import { presentCliScanSummary } from "./presentation/presenters/presentCliScanSummary.js";
import { renderCliScanSummaryText } from "./presentation/render/renderCliScanSummaryText.js";
import { scanSurfaceCopy } from "./scanSurfaceCopy.js";
import type { ScanResult } from "./types.js";

export type ActionsSummaryProfile = "trusted" | "development";

function copyLine(
  flat: Record<string, string>,
  key: string,
  fallback: string,
): string {
  const v = flat[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

export function buildActionsStepSummaryMarkdown(opts: {
  result: ScanResult;
  profile: ActionsSummaryProfile;
  copy: Record<string, string>;
}): string {
  const { result, profile, copy: flat } = opts;
  const bundle = buildScanPresentationBundle({
    result,
    pipelineStatus: "done",
  });

  const lines: string[] = [];
  if (profile !== "trusted") {
    const title = copyLine(
      flat,
      "actions.demoSummaryTitle",
      scanSurfaceCopy.actions.demoSummaryTitle,
    );
    const banner = copyLine(
      flat,
      "actions.demoSummaryBanner",
      scanSurfaceCopy.actions.demoSummaryBanner,
    );
    lines.push(`# ${title}`, "", banner, "");
  }

  if (!bundle) {
    lines.push("## Analysis could not be completed", "");
    return lines.join("\n");
  }

  const cli = presentCliScanSummary(bundle, {
    repoLabel: copyLine(flat, "actions.repoLabel", "repository"),
  });
  lines.push(renderCliScanSummaryText(cli));
  return lines.join("\n");
}
