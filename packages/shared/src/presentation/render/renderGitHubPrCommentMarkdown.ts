import { normalizeGeneratedText } from "../../normalizeGeneratedText.js";
import type { GitHubPrCommentPresentation } from "../dto/githubAndCliPresentation.js";

function renderGuidanceBlock(
  message: string,
  where: string,
  action: string,
): string {
  return [
    normalizeGeneratedText(message),
    "",
    "**Where it shows up**",
    "",
    normalizeGeneratedText(where),
    "",
    "**What to do**",
    "",
    normalizeGeneratedText(action),
  ].join("\n");
}

export function renderGitHubPrCommentMarkdown(
  p: GitHubPrCommentPresentation,
): string {
  const parts = [`**${normalizeGeneratedText(p.title)}**`];
  if (p.introLines.length > 0) {
    parts.push(
      "",
      p.introLines.map((l) => normalizeGeneratedText(l)).join("\n"),
    );
  }
  for (const block of p.guidanceBlocks) {
    parts.push(
      "",
      renderGuidanceBlock(
        block.message,
        block.where ?? "See scan detail.",
        block.action ?? "Review before merge.",
      ),
    );
  }
  return parts.join("\n\n---\n\n").trimEnd();
}
