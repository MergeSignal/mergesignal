import { nextJsConfig } from "@repo/eslint-config/next-js";

// Files permitted to import @mantine/core directly.
// All other code must use the MS* shared primitive layer.
// Add a new entry here when introducing a new MS* wrapper component.
// Patterns use **/ prefix so they match whether ESLint is run from apps/web/
// or from the monorepo root (where the pre-commit hook runs it).
const MANTINE_APPROVED_FILES = [
  "**/app/theme.ts",
  "**/app/components/shared/MantineProviderWrapper/**",
  "**/app/components/shared/MSButton/**",
  "**/app/components/shared/MSInput/**",
  "**/app/components/shared/MSSelect/**",
  "**/app/components/shared/CodeBlock/**",
  "**/app/components/shared/testUtils.tsx",
];

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  // Restrict @mantine/core imports across the entire app.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@mantine/core",
              message:
                "Do not import @mantine/core directly. Use the MS* shared primitive layer " +
                "(MSButton, MSInput, MSSelect, …) from app/components/shared/ instead.",
            },
          ],
        },
      ],
    },
  },
  // Allow @mantine/core only in the approved wrapper files above.
  {
    files: MANTINE_APPROVED_FILES,
    rules: { "no-restricted-imports": "off" },
  },
];
