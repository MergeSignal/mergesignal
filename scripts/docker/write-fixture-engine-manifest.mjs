#!/usr/bin/env node
/**
 * Write engine-manifest.json for CI fixture engine builds.
 * Usage: node scripts/docker/write-fixture-engine-manifest.mjs /engine-out
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: write-fixture-engine-manifest.mjs <engine-out-dir>");
  process.exit(1);
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

const ingressRel = "dist/production-scan-ingress.js";
const ingressPath = path.join(outDir, ingressRel);
if (!fs.existsSync(ingressPath)) {
  console.error(`Fixture ingress artifact missing: ${ingressPath}`);
  process.exit(1);
}

const manifest = {
  schemaVersion: 1,
  repository: "MergeSignal/mergesignal",
  ref: "engine-test-fixture",
  engineReleaseVersion: "engine-test-fixture",
  engineReleaseGitSha: "fixture",
  packageVersion: "0.0.0",
  nodeVersion: process.version,
  pnpmVersion: process.env.PNPM_VERSION ?? "",
  distSha256: "fixture",
  collectionIngressPath: ingressRel,
  collectionIngressSha256: sha256File(ingressPath),
  implPath: "dist/index.js",
  builtAt: new Date().toISOString(),
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "engine-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
