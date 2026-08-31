import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority,
  readScanPrepSourceSharedDependencyVersion,
  readSourcePackageJsonRaw,
  validatePackedScanPrepArtifact,
} from "../../../scripts/ci/lib/scan-prep-pack-artifact.ts";
import { readSharedReleaseVersion } from "../../../scripts/ci/lib/shared-package-version.ts";

const SHARED_PACKAGE_JSON = path.resolve(
  import.meta.dirname,
  "../../../packages/shared/package.json",
);
const SCAN_PREP_PACKAGE_JSON = path.resolve(
  import.meta.dirname,
  "../../../packages/scan-prep/package.json",
);

describe("shared package version authority", () => {
  it("reads the Shared release version from packages/shared/package.json", () => {
    const manifest = JSON.parse(readFileSync(SHARED_PACKAGE_JSON, "utf8")) as {
      version: string;
    };
    expect(readSharedReleaseVersion()).toBe(manifest.version);
  });

  it("fails closed when Shared release manifest is invalid JSON", () => {
    const original = readFileSync(SHARED_PACKAGE_JSON, "utf8");
    writeFileSync(SHARED_PACKAGE_JSON, "{not-json");
    try {
      expect(() => readSharedReleaseVersion()).toThrow(/invalid JSON/);
    } finally {
      writeFileSync(SHARED_PACKAGE_JSON, original);
    }
  });
});

describe("scan-prep Shared dependency alignment", () => {
  let sharedOriginal: string;
  let scanPrepOriginal: string;

  afterEach(() => {
    writeFileSync(SHARED_PACKAGE_JSON, sharedOriginal);
    writeFileSync(SCAN_PREP_PACKAGE_JSON, scanPrepOriginal);
  });

  it("requires scan-prep source dependency to match Shared release authority", () => {
    sharedOriginal = readFileSync(SHARED_PACKAGE_JSON, "utf8");
    scanPrepOriginal = readFileSync(SCAN_PREP_PACKAGE_JSON, "utf8");
    expect(() =>
      assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority(),
    ).not.toThrow();
    expect(readScanPrepSourceSharedDependencyVersion()).toBe(
      readSharedReleaseVersion(),
    );
  });

  it("rejects scan-prep source drift from Shared release authority", () => {
    sharedOriginal = readFileSync(SHARED_PACKAGE_JSON, "utf8");
    scanPrepOriginal = readFileSync(SCAN_PREP_PACKAGE_JSON, "utf8");
    const scanPrepManifest = JSON.parse(scanPrepOriginal) as {
      dependencies: Record<string, string>;
    };
    scanPrepManifest.dependencies["@mergesignal/shared"] = "0.0.1";
    writeFileSync(
      SCAN_PREP_PACKAGE_JSON,
      `${JSON.stringify(scanPrepManifest, null, 2)}\n`,
    );

    expect(() =>
      assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority(),
    ).toThrow(/must match packages\/shared\/package\.json version/);
  });

  it("validates packed artifact Shared dependency against source manifest", () => {
    const sourceBefore = readSourcePackageJsonRaw();
    const sourceManifest = JSON.parse(sourceBefore) as {
      dependencies?: Record<string, string>;
    };
    const violations = validatePackedScanPrepArtifact({
      tarballPath: "/tmp/unused.tgz",
      tarballName: "unused.tgz",
      version: "0.0.0",
      files: [],
      manifest: {
        name: "@mergesignal/scan-prep",
        version: "0.0.0",
        dependencies: {
          "@mergesignal/shared": "9.9.9",
        },
      },
      sourceManifestBefore: sourceBefore,
      validationMode: "fixture",
    });

    expect(violations).toContainEqual(
      expect.stringMatching(
        new RegExp(
          `packed @mergesignal/shared must match source manifest \\(${sourceManifest.dependencies?.["@mergesignal/shared"]}\\)`,
        ),
      ),
    );
  });
});
