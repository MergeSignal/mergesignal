import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

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

describe("shared package version authority", () => {
  it("reads the Shared release version from packages/shared/package.json", () => {
    const manifest = JSON.parse(readFileSync(SHARED_PACKAGE_JSON, "utf8")) as {
      version: string;
    };
    expect(readSharedReleaseVersion()).toBe(manifest.version);
  });

  it("fails closed when Shared release manifest is invalid JSON", () => {
    const fixtureDir = mkdtempSync(
      path.join(tmpdir(), "ms-shared-release-manifest-"),
    );
    const tempManifestPath = path.join(fixtureDir, "package.json");
    writeFileSync(tempManifestPath, "{not-json", "utf8");
    try {
      expect(() => readSharedReleaseVersion(tempManifestPath)).toThrow(
        /invalid JSON/,
      );
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});

describe("scan-prep Shared dependency alignment", () => {
  it("requires scan-prep source dependency to match Shared release authority", () => {
    expect(() =>
      assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority(),
    ).not.toThrow();
    expect(readScanPrepSourceSharedDependencyVersion()).toBe(
      readSharedReleaseVersion(),
    );
  });

  it("rejects scan-prep source drift from Shared release authority", () => {
    const fixtureDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-shared-alignment-"),
    );
    const sharedManifestPath = path.join(fixtureDir, "shared-package.json");
    const scanPrepManifestPath = path.join(
      fixtureDir,
      "scan-prep-package.json",
    );
    const sharedVersion = "0.19.0";
    writeFileSync(
      sharedManifestPath,
      `${JSON.stringify({ name: "@mergesignal/shared", version: sharedVersion }, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      scanPrepManifestPath,
      `${JSON.stringify(
        {
          name: "@mergesignal/scan-prep",
          version: "0.1.7",
          dependencies: { "@mergesignal/shared": "0.0.1" },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    try {
      expect(() =>
        assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority({
          sharedPackageJsonPath: sharedManifestPath,
          scanPrepPackageJsonPath: scanPrepManifestPath,
        }),
      ).toThrow(/must match packages\/shared\/package\.json version/);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
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
