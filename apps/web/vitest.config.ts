import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  test: {
    // Globals enabled so @testing-library/jest-dom can extend expect in setupFiles.
    globals: true,
    // Default environment for lib/** tests — preserves existing behaviour unchanged.
    environment: "node",
    environmentMatchGlobs: [
      // Component tests under app/components need a real DOM.
      // happy-dom is used instead of jsdom for Node 18 ESM compatibility.
      ["app/components/**/*.test.tsx", "happy-dom"],
    ],
    include: [
      "lib/**/*.test.{ts,tsx}",
      "app/components/**/*.test.tsx",
      "app/api/**/*.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
