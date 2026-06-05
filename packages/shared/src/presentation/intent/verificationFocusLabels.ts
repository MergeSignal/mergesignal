const FOCUS_LABELS: Record<string, string> = {
  ci: "CI",
  typecheck: "typecheck",
  build: "build",
  routes: "routes",
  middleware: "middleware/hooks",
  hooks: "middleware/hooks",
  auth_flow: "auth flow",
  auth: "auth flow",
  serialization: "serialization",
  error_handling: "error handling",
  handlers: "handlers",
  plugins: "plugins",
  session: "session",
  workers: "workers",
  queue: "queue",
  test_suite: "test suite",
  lint: "lint",
  format: "format",
};

export function labelVerificationFocus(focus: string): string {
  const key = focus.trim().toLowerCase();
  if (!key) return "";
  return FOCUS_LABELS[key] ?? focus.replace(/_/g, " ");
}

export function mergeVerificationFocusLabels(
  focusLists: string[][],
  max = 6,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of focusLists) {
    for (const f of list) {
      const label = labelVerificationFocus(f);
      if (!label) continue;
      const norm = label.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push(label);
      if (out.length >= max) return out;
    }
  }
  return out;
}
