import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scanSurfaceCopyFlat } from "./scanSurfaceCopy.js";

describe("scanSurfaceCopy", () => {
  it("matches generated CI JSON (no drift)", () => {
    const root = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
    );
    const jsonPath = join(root, "scripts/ci/scan-surface-copy.generated.json");
    const onDisk = JSON.parse(readFileSync(jsonPath, "utf8")) as Record<
      string,
      string
    >;
    const fromTs = scanSurfaceCopyFlat();
    expect(fromTs).toEqual(onDisk);
  });
});
