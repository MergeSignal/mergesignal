import type { CliScanPresentation } from "../dto/githubAndCliPresentation.js";

export function renderCliScanSummaryText(p: CliScanPresentation): string {
  const lines: string[] = [];
  if (p.header.repoLabel && p.header.repoLabel !== "scan") {
    lines.push(p.header.repoLabel, "");
  }
  if (p.report.dependency) {
    lines.push(p.report.dependency, "");
  }
  lines.push(`Assessment: ${p.report.assessmentLabel}`);
  appendSection(lines, "Why this assessment", p.report.why);
  appendSection(lines, "Verify", p.report.verify);
  if (p.report.notAffected) {
    lines.push("", "Not affected", p.report.notAffected);
  }
  if (p.report.resolution) {
    lines.push("", "Resolution", p.report.resolution);
  }
  appendSection(lines, "Limitations", p.report.limitations);
  appendSection(lines, "Findings", p.report.findings);
  return lines.join("\n");
}

function appendSection(lines: string[], title: string, items: string[]): void {
  if (items.length === 0) return;
  lines.push("", title);
  for (const item of items) lines.push(item);
}
