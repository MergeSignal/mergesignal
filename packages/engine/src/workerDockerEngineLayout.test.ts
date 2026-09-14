import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const workerDockerfile = path.join(repoRoot, "apps/worker/Dockerfile");

describe("worker Docker runtime engine layout", () => {
  it("copies the governed engine-out tree so manifest-addressable ingress is preserved", () => {
    const dockerfile = fs.readFileSync(workerDockerfile, "utf8");

    expect(dockerfile).toMatch(
      /COPY --from=engine-builder \/engine-out\/ \/app\/engine\//,
    );
    expect(dockerfile).not.toMatch(
      /test -f \/app\/engine\/dist\/production-scan-ingress\.js/,
    );
  });
});
