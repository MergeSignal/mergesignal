import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function implSpec(): string {
  return String(process.env.MERGESIGNAL_ENGINE_IMPL ?? "").trim();
}

export function engineManifestPath(): string {
  return String(process.env.MERGESIGNAL_ENGINE_MANIFEST ?? "").trim();
}

export async function readEngineManifest(): Promise<Record<
  string,
  unknown
> | null> {
  const manifestPath = engineManifestPath();
  if (!manifestPath) return null;
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // optional outside production images
  }
  return null;
}

/** Resolve production-scan-ingress module path relative to engine-manifest.json. */
export async function productionScanIngressModuleSpec(): Promise<string> {
  const manifest = await readEngineManifest();
  const ingressRel =
    typeof manifest?.collectionIngressPath === "string"
      ? manifest.collectionIngressPath
      : "dist/production-scan-ingress.js";

  const manifestPath = engineManifestPath();
  if (manifestPath) {
    const baseDir = path.dirname(manifestPath);
    return pathToFileURL(path.join(baseDir, ingressRel)).href;
  }

  const spec = implSpec();
  if (spec.startsWith("file:")) {
    const implFile = fileURLToPath(spec);
    const ingressFile = path.join(
      path.dirname(implFile),
      "production-scan-ingress.js",
    );
    return pathToFileURL(ingressFile).href;
  }

  throw new Error(
    "Production scan ingress requires MERGESIGNAL_ENGINE_MANIFEST or file: MERGESIGNAL_ENGINE_IMPL",
  );
}

const SHA256_HEX = /^[a-f0-9]{64}$/;

/** When manifest records a 64-char sha256, verify the artifact bytes match. */
export async function verifyManifestSha256ForFile(
  manifest: Record<string, unknown> | null,
  manifestField: string,
  filePath: string,
): Promise<void> {
  const expected = manifest?.[manifestField];
  if (typeof expected !== "string" || !SHA256_HEX.test(expected)) {
    return;
  }
  const fs = await import("node:fs/promises");
  const crypto = await import("node:crypto");
  const bytes = await fs.readFile(filePath);
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) {
    throw new Error(
      `Engine manifest ${manifestField} mismatch for ${filePath}`,
    );
  }
}
