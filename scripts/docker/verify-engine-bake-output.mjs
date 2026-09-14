#!/usr/bin/env node
/**
 * Fail closed if a private engine bake cannot load its declared production ingress module graph.
 * Usage: node scripts/docker/verify-engine-bake-output.mjs <engine-out-dir>
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: verify-engine-bake-output.mjs <engine-out-dir>");
  process.exit(1);
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

const manifestPath = path.join(outDir, "engine-manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`Missing engine manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const implRel =
  typeof manifest.implPath === "string" ? manifest.implPath : "dist/index.js";
const ingressRel =
  typeof manifest.collectionIngressPath === "string"
    ? manifest.collectionIngressPath
    : "ingress/dist/production-scan-ingress.js";

const implPath = path.join(outDir, implRel);
const ingressPath = path.join(outDir, ingressRel);

for (const [label, filePath] of [
  ["impl", implPath],
  ["collection ingress", ingressPath],
]) {
  if (!fs.existsSync(filePath)) {
    console.error(`Baked ${label} artifact missing: ${filePath}`);
    process.exit(1);
  }
}

if (typeof manifest.distSha256 === "string" && /^[a-f0-9]{64}$/.test(manifest.distSha256)) {
  const actual = sha256File(implPath);
  if (actual !== manifest.distSha256) {
    console.error(`distSha256 mismatch for ${implPath}`);
    process.exit(1);
  }
}

if (
  typeof manifest.collectionIngressSha256 === "string" &&
  /^[a-f0-9]{64}$/.test(manifest.collectionIngressSha256)
) {
  const actual = sha256File(ingressPath);
  if (actual !== manifest.collectionIngressSha256) {
    console.error(`collectionIngressSha256 mismatch for ${ingressPath}`);
    process.exit(1);
  }
}

let ingressMod;
try {
  ingressMod = await import(pathToFileURL(ingressPath).href);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    `Failed to import baked production ingress module ${ingressPath}: ${message}`,
  );
  process.exit(1);
}

if (typeof ingressMod.orchestrateProductionScanIngress !== "function") {
  console.error(
    `Baked ingress module must export orchestrateProductionScanIngress: ${ingressPath}`,
  );
  process.exit(1);
}

console.log(
  `[verify-engine-bake-output] OK: ${ingressRel} loads with orchestrateProductionScanIngress`,
);
