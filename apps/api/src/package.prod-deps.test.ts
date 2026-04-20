/**
 * Ensures modules imported by compiled server code are listed under `dependencies`.
 * Docker production images use `pnpm install --prod`, which omits `devDependencies`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pkgPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json",
);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("package.json production dependencies", () => {
  it("declares fastify as a dependency (runtime server import)", () => {
    expect(pkg.dependencies?.fastify).toMatch(/^\^/);
    expect(pkg.devDependencies?.fastify).toBeUndefined();
  });
});
