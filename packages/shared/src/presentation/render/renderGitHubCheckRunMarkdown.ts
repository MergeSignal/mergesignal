import { normalizeGeneratedText } from "../../normalizeGeneratedText.js";
import type { GitHubCheckRunPresentation } from "../dto/githubAndCliPresentation.js";

export function renderGitHubCheckRunMarkdown(
  p: GitHubCheckRunPresentation,
): string {
  const parts: string[] = [
    `**${normalizeGeneratedText(p.title)}**`,
    "",
    p.summaryLead,
    "",
  ];

  for (const section of p.sections) {
    if (section.id === "footer") {
      parts.push(section.bullets.join("\n"));
      continue;
    }
    if (section.title) {
      parts.push(`### ${section.title}`, "");
    }
    for (const bullet of section.bullets) {
      parts.push(`- ${normalizeGeneratedText(bullet)}`);
    }
    parts.push("");
  }

  return parts.join("\n").trimEnd();
}
