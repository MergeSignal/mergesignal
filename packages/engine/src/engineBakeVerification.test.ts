import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const verifyScript = path.join(
  repoRoot,
  "scripts/docker/verify-engine-bake-output.mjs",
);

describe("verify-engine-bake-output", () => {
  it("rejects ingress entry when relative module graph is incomplete", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ms-bake-verify-"));
    const ingressDir = path.join(tmp, "ingress/dist");
    fs.mkdirSync(ingressDir, { recursive: true });
    fs.mkdirSync(path.join(tmp, "dist"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "dist/index.js"), "export {};\n");
    fs.writeFileSync(
      path.join(ingressDir, "production-scan-ingress.js"),
      `import { orchestrateCollection } from './collection-orchestrator.js';
export async function orchestrateProductionScanIngress() { return orchestrateCollection; }`,
    );
    const ingressBytes = fs.readFileSync(
      path.join(ingressDir, "production-scan-ingress.js"),
    );
    const ingressSha = crypto
      .createHash("sha256")
      .update(ingressBytes)
      .digest("hex");
    fs.writeFileSync(
      path.join(tmp, "engine-manifest.json"),
      JSON.stringify({
        implPath: "dist/index.js",
        distSha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(tmp, "dist/index.js")))
          .digest("hex"),
        collectionIngressPath: "ingress/dist/production-scan-ingress.js",
        collectionIngressSha256: ingressSha,
      }),
    );

    expect(() =>
      execFileSync("node", [verifyScript, tmp], {
        encoding: "utf8",
        stdio: "pipe",
      }),
    ).toThrow();
  });

  it("accepts ingress entry when module graph resolves", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ms-bake-verify-"));
    const ingressDir = path.join(tmp, "ingress/dist");
    fs.mkdirSync(ingressDir, { recursive: true });
    fs.mkdirSync(path.join(tmp, "dist"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "dist/index.js"), "export {};\n");
    fs.writeFileSync(
      path.join(ingressDir, "collection-orchestrator.js"),
      "export function orchestrateCollection() {}\n",
    );
    fs.writeFileSync(
      path.join(ingressDir, "production-scan-ingress.js"),
      `import { orchestrateCollection } from './collection-orchestrator.js';
export async function orchestrateProductionScanIngress() { return orchestrateCollection(); }`,
    );
    const ingressPath = path.join(ingressDir, "production-scan-ingress.js");
    fs.writeFileSync(
      path.join(tmp, "engine-manifest.json"),
      JSON.stringify({
        implPath: "dist/index.js",
        distSha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(tmp, "dist/index.js")))
          .digest("hex"),
        collectionIngressPath: "ingress/dist/production-scan-ingress.js",
        collectionIngressSha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(ingressPath))
          .digest("hex"),
      }),
    );

    const out = execFileSync("node", [verifyScript, tmp], {
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(out).toMatch(/OK:/);
  });
});
