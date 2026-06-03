const TYPOGRAPHIC_DASH = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * Enforce ASCII-safe generated user-facing text (hyphens, separators, ellipsis).
 */
export function normalizeGeneratedText(text: string): string {
  return text
    .replace(TYPOGRAPHIC_DASH, "-")
    .replace(/\u00B7/g, " | ")
    .replace(/\u2026/g, "...")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-");
}

export function normalizeGeneratedTextNullable(
  text: string | null | undefined,
): string | null {
  if (text == null) return null;
  const normalized = normalizeGeneratedText(text);
  return normalized.length > 0 ? normalized : null;
}

/** Normalize every string field on a shallow object (presenter DTOs). */
export function normalizeGeneratedStrings<T extends Record<string, unknown>>(
  obj: T,
): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string") {
      out[key] = normalizeGeneratedText(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "string" ? normalizeGeneratedText(item) : item,
      );
    }
  }
  return out as T;
}
