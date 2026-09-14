import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  __resetEngineLoaderCacheForTests,
  analyze,
  orchestrateProductionScanIngress,
} from "./loader.js";

describe("production scan ingress loader", () => {
  const originalEnv = process.env;
  let tmpDir: string;

  beforeEach(() => {
    __resetEngineLoaderCacheForTests();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ms-engine-loader-"));
    process.env = { ...originalEnv };
    process.env.MERGESIGNAL_ENGINE_IMPL = `file:${path.join(tmpDir, "dist", "index.js")}`;
    process.env.MERGESIGNAL_ENGINE_MANIFEST = path.join(
      tmpDir,
      "engine-manifest.json",
    );

    fs.mkdirSync(path.join(tmpDir, "dist"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "dist", "index.js"),
      `export async function analyze(req, codeAnalysis, options) {
        return {
          repoId: req.repoId,
          dependencyGraph: req.dependencyGraph ?? {},
          generatedAt: new Date().toISOString(),
          methodologyVersion: 'loader-test/v1',
          receivedOptions: options ?? null,
        };
      }
      export async function simulateUpgrade() {
        return { before: {}, after: {}, delta: {}, generatedAt: new Date().toISOString() };
      }`,
    );
    fs.writeFileSync(
      path.join(tmpDir, "dist", "production-scan-ingress.js"),
      `export async function orchestrateProductionScanIngress(job, options) {
        return {
          scanRequest: { repoId: job.repoId, dependencyGraph: job.dependencyGraph ?? {} },
          warnings: [],
          preparationSummary: { changedPackageCount: 0 },
          collectionContext: { marker: 'ingress-ok', reasoningTier: options?.reasoningTier ?? null },
        };
      }`,
    );
    fs.writeFileSync(
      path.join(tmpDir, "engine-manifest.json"),
      JSON.stringify({
        collectionIngressPath: "dist/production-scan-ingress.js",
        implPath: "dist/index.js",
      }),
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    __resetEngineLoaderCacheForTests();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads ingress and forwards production analyze options", async () => {
    const prepared = await orchestrateProductionScanIngress({
      scanId: "s1",
      repoId: "acme/app",
      dependencyGraph: {},
    });
    expect(prepared.collectionContext).toMatchObject({ marker: "ingress-ok" });

    const result = (await analyze(prepared.scanRequest, undefined, {
      collectionContext: prepared.collectionContext,
      reasoningTier: "pro",
    })) as { receivedOptions?: { reasoningTier?: string } };

    expect(result.receivedOptions).toMatchObject({
      reasoningTier: "pro",
      collectionContext: { marker: "ingress-ok" },
    });
  });
});
