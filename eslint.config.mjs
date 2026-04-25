import { config as base } from "./packages/eslint-config/base.js";

/**
 * Lets `eslint --fix` from the repo root (lint-staged) resolve config for
 * staged files in each workspace. Per-app configs still apply when linting
 * from that package directory.
 */
function forWorkspace(globs) {
  return base.map((entry) => {
    if (
      entry &&
      typeof entry === "object" &&
      "ignores" in entry &&
      !("languageOptions" in entry) &&
      !("plugins" in entry) &&
      !("rules" in entry)
    ) {
      return entry;
    }
    return { ...entry, files: globs };
  });
}

export default [
  ...forWorkspace(["apps/api/**/*.{ts,tsx}"]),
  ...forWorkspace(["apps/cli/**/*.{ts,tsx}"]),
  ...forWorkspace(["apps/web/**/*.{ts,tsx}"]),
  ...forWorkspace(["packages/engine/**/*.{ts,tsx}"]),
  ...forWorkspace(["packages/engine-stub/**/*.{ts,tsx}"]),
  ...forWorkspace(["packages/shared/**/*.{ts,tsx}"]),
];
