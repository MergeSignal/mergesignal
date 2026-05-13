/**
 * Writes scripts/ci/scan-surface-copy.generated.json for CI renderers.
 * Run from repo root: pnpm --filter @mergesignal/shared exec tsx packages/shared/scripts/emit-scan-surface-copy.ts
 * Or: pnpm --filter @mergesignal/shared run generate:ci-copy
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanSurfaceCopyFlat } from "../src/scanSurfaceCopy.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const outPath = join(
  repoRoot,
  "scripts",
  "ci",
  "scan-surface-copy.generated.json",
);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `${JSON.stringify(scanSurfaceCopyFlat(), null, 2)}\n`,
  "utf8",
);
