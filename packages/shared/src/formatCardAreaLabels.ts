import { GENERIC_CARD_AREA_PHRASES } from "./cardSummaryCopy.js";

const PATH_LIKE = /[/\\]|^packages\/|\.tsx?$|\.jsx?$|^src\//i;
const KEBAB_SNAKE = /^[a-z0-9]+[-_][a-z0-9_-]+$/;

function normalizeKey(label: string): string {
  return label.trim().toLowerCase();
}

function isTechnicalLabel(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  if (PATH_LIKE.test(t)) return true;
  if (KEBAB_SNAKE.test(t) && !/\s/.test(t)) return true;
  return false;
}

function isGenericArea(label: string): boolean {
  const key = normalizeKey(label);
  return GENERIC_CARD_AREA_PHRASES.some(
    (g) => key === g || key.startsWith(`${g} `) || key.endsWith(` ${g}`),
  );
}

function humanizeLabel(label: string): string {
  const clean = label.replace(/^(Finding:\s*|Area:\s*)/i, "").trim();
  if (!clean) return "";
  if (/\s/.test(clean) || /^[A-Z]/.test(clean)) return clean;
  return clean
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Filter and rank area labels for dashboard cards (max 2).
 * Longer specific labels win; generic taxonomy is dropped.
 */
export function formatCardAreaLabels(
  areas: string[] | null | undefined,
  max = 2,
): string[] {
  if (!Array.isArray(areas) || areas.length === 0) return [];

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const raw of areas) {
    if (isTechnicalLabel(raw)) continue;
    const label = humanizeLabel(raw);
    if (!label || label.length < 4) continue;
    if (isGenericArea(label)) continue;
    const key = normalizeKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(label);
  }

  candidates.sort((a, b) => b.length - a.length);
  return candidates.slice(0, max);
}

/** Join formatted areas for evidence row display. */
export function joinCardAreaLabels(areas: string[]): string | null {
  const formatted = formatCardAreaLabels(areas);
  if (formatted.length === 0) return null;
  return formatted.join(" · ");
}
