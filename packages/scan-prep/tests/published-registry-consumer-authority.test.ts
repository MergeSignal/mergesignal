import { describe, expect, it } from "vitest";

import {
  PACKAGE_NAME,
  buildPublishedRegistryConsumerPackageJson,
} from "../../../scripts/ci/check-scan-prep-published-registry.ts";
import { readRootPackageManagerAuthority } from "../../../scripts/ci/lib/root-package-manager.ts";

const FIXTURE_SCAN_PREP_VERSION = "0.1.8";
const FIXTURE_SHARED_VERSION = "0.19.1";

describe("published-registry isolated consumer packageManager authority", () => {
  it("imports the verifier module without executing CLI main", () => {
    expect(typeof buildPublishedRegistryConsumerPackageJson).toBe("function");
  });

  it("builds the ephemeral consumer manifest with root packageManager authority", () => {
    const manifest = buildPublishedRegistryConsumerPackageJson(
      FIXTURE_SCAN_PREP_VERSION,
      FIXTURE_SHARED_VERSION,
    );

    expect(manifest.packageManager).toBeDefined();
    expect(manifest.packageManager).toBe(readRootPackageManagerAuthority());
    expect(manifest.name).toBe("scan-prep-published-registry-smoke");
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe("module");
    expect(manifest.dependencies[PACKAGE_NAME]).toBe(FIXTURE_SCAN_PREP_VERSION);
    expect(manifest.dependencies["@mergesignal/shared"]).toBe(
      FIXTURE_SHARED_VERSION,
    );
    expect(manifest.devDependencies.typescript).toBe("^5.9.3");
  });
});
