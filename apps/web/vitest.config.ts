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
      // Shared primitive component tests need a real DOM.
      // happy-dom is used instead of jsdom for Node 18 ESM compatibility.
      ["app/components/shared/**/*.test.tsx", "happy-dom"],
    ],
    include: ["lib/**/*.test.{ts,tsx}", "app/components/shared/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
