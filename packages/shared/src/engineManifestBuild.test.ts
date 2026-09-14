import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const buildScript = path.join(
  repoRoot,
  "scripts/docker/build-private-engine.sh",
);

describe("build-private-engine manifest packageVersion", () => {
  it("reads version from analysis-engine package root when impl file is under dist/", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ms-engine-manifest-"));
    const engineRoot = path.join(tmp, "engine");
    const pkgDir = path.join(engineRoot, "packages/analysis-engine");
    const distDir = path.join(pkgDir, "dist");
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({
        name: "@mergesignal/analysis-engine",
        version: "2.20.1",
      }),
    );
    fs.writeFileSync(path.join(distDir, "index.js"), "export {};\n");
    const ingressDir = path.join(
      engineRoot,
      "packages/evidence-collection-ingress/dist",
    );
    fs.mkdirSync(ingressDir, { recursive: true });
    const ingressFile = path.join(ingressDir, "production-scan-ingress.js");
    fs.writeFileSync(
      ingressFile,
      "export async function orchestrateProductionScanIngress() {}\n",
    );

    const output = path.join(tmp, "out");
    fs.mkdirSync(output, { recursive: true });
    const bakedIngressDir = path.join(output, "ingress/dist");
    fs.mkdirSync(bakedIngressDir, { recursive: true });
    const bakedIngressFile = path.join(
      bakedIngressDir,
      "production-scan-ingress.js",
    );
    fs.copyFileSync(ingressFile, bakedIngressFile);
    const bakedImpl = path.join(output, "dist/index.js");
    fs.mkdirSync(path.dirname(bakedImpl), { recursive: true });
    fs.copyFileSync(path.join(distDir, "index.js"), bakedImpl);
    const manifestPath = path.join(output, "engine-manifest.json");
    const collectionIngressRel = "ingress/dist/production-scan-ingress.js";

    execFileSync(
      "bash",
      [
        "-c",
        `source "${buildScript}" && write_manifest "${engineRoot}" "${bakedImpl}" "${manifestPath}" "${bakedIngressFile}" "${collectionIngressRel}"`,
      ],
      { env: { ...process.env, MERGESIGNAL_ENGINE_REF: "v2.20.1" } },
    );

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      packageVersion: string;
      engineReleaseVersion: string;
      engineReleaseGitSha: string;
      distSha256: string;
      collectionIngressPath: string;
      collectionIngressSha256: string;
    };

    expect(manifest.packageVersion).toBe("2.20.1");
    expect(manifest.engineReleaseVersion).toBe("v2.20.1");
    expect(manifest.distSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.collectionIngressPath).toBe(
      "ingress/dist/production-scan-ingress.js",
    );
    expect(manifest.collectionIngressSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
