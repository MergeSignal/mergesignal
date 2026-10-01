import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertScanPrepSharedDependencyAlignment,
  assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority,
  readSourcePackageJsonRaw,
  type ScanPrepSharedDependencyAlignmentDeps,
  validatePackedScanPrepArtifact,
} from "../../../scripts/ci/lib/scan-prep-pack-artifact.ts";
import { readSharedReleaseVersion } from "../../../scripts/ci/lib/shared-package-version.ts";

const SHARED_PACKAGE_JSON = path.resolve(
  import.meta.dirname,
  "../../../packages/shared/package.json",
);

function alignmentDeps(input: {
  availability: ScanPrepSharedDependencyAlignmentDeps["scanPrepVersionAvailability"];
  publishedPin?: string;
  publishedPinError?: string;
}): ScanPrepSharedDependencyAlignmentDeps {
  return {
    scanPrepVersionAvailability: input.availability,
    readPublishedSharedDependencyPin: () => {
      if (input.publishedPinError) {
        throw new Error(input.publishedPinError);
      }
      if (input.publishedPin === undefined) {
        throw new Error("test fixture missing publishedPin");
      }
      return input.publishedPin;
    },
  };
}

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
  it("accepts scan-prep alignment with Shared release authority", async () => {
    await expect(
      assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority(),
    ).resolves.toBeUndefined();
  });

  it("passes when a published scan-prep pin matches source while workspace Shared advances", async () => {
    await expect(
      assertScanPrepSharedDependencyAlignment(
        {
          sharedReleaseVersion: "0.20.0",
          scanPrepVersion: "8.8.8-published-valid",
          scanPrepSharedVersion: "0.19.1",
        },
        alignmentDeps({
          availability: () => ({
            kind: "published",
            version: "8.8.8-published-valid",
          }),
          publishedPin: "0.19.1",
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("fails when a published scan-prep source drifts from the npm dependency even if workspace Shared matches", async () => {
    await expect(
      assertScanPrepSharedDependencyAlignment(
        {
          sharedReleaseVersion: "0.20.0",
          scanPrepVersion: "8.8.8-published-drift",
          scanPrepSharedVersion: "0.20.0",
        },
        alignmentDeps({
          availability: () => ({
            kind: "published",
            version: "8.8.8-published-drift",
          }),
          publishedPin: "0.19.1",
        }),
      ),
    ).rejects.toThrow(
      /must match the published @mergesignal\/scan-prep@8\.8\.8-published-drift npmjs dependency/,
    );
  });

  it("passes for an unpublished scan-prep version when source matches workspace Shared", async () => {
    await expect(
      assertScanPrepSharedDependencyAlignment(
        {
          sharedReleaseVersion: "0.20.0",
          scanPrepVersion: "9.9.9-unpublished-valid",
          scanPrepSharedVersion: "0.20.0",
        },
        alignmentDeps({
          availability: () => ({ kind: "not_found" }),
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("fails for an unpublished scan-prep version when source differs from workspace Shared", async () => {
    await expect(
      assertScanPrepSharedDependencyAlignment(
        {
          sharedReleaseVersion: "0.20.0",
          scanPrepVersion: "9.9.9-unpublished-invalid",
          scanPrepSharedVersion: "0.19.1",
        },
        alignmentDeps({
          availability: () => ({ kind: "not_found" }),
        }),
      ),
    ).rejects.toThrow(
      /must match packages\/shared\/package\.json version \(0\.20\.0\) for unpublished/,
    );
  });

  it("fails closed when published scan-prep registry availability cannot be proven", async () => {
    await expect(
      assertScanPrepSharedDependencyAlignment(
        {
          sharedReleaseVersion: "0.20.0",
          scanPrepVersion: "8.8.8-unavailable",
          scanPrepSharedVersion: "0.20.0",
        },
        alignmentDeps({
          availability: () => ({
            kind: "unavailable",
            message: "registry timeout",
          }),
        }),
      ),
    ).rejects.toThrow(/registry availability could not be proven/);
  });

  it("fails closed when published dependency truth cannot be read from npmjs", async () => {
    await expect(
      assertScanPrepSharedDependencyAlignment(
        {
          sharedReleaseVersion: "0.20.0",
          scanPrepVersion: "8.8.8-published-pin-unavailable",
          scanPrepSharedVersion: "0.19.1",
        },
        alignmentDeps({
          availability: () => ({
            kind: "published",
            version: "8.8.8-published-pin-unavailable",
          }),
          publishedPinError: "npm view dependencies failed",
        }),
      ),
    ).rejects.toThrow(
      /could not read published @mergesignal\/shared dependency/,
    );
  });

  it("allows scan-prep to remain on published Shared pin while workspace Shared advances (manifest paths)", async () => {
    const fixtureDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-published-pin-"),
    );
    const sharedManifestPath = path.join(fixtureDir, "shared-package.json");
    const scanPrepManifestPath = path.join(
      fixtureDir,
      "scan-prep-package.json",
    );
    const scanPrepVersion = "8.8.8-manifest-published";
    writeFileSync(
      sharedManifestPath,
      `${JSON.stringify({ name: "@mergesignal/shared", version: "0.20.0" }, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      scanPrepManifestPath,
      `${JSON.stringify(
        {
          name: "@mergesignal/scan-prep",
          version: scanPrepVersion,
          dependencies: { "@mergesignal/shared": "0.19.1" },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    try {
      await expect(
        assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority({
          sharedPackageJsonPath: sharedManifestPath,
          scanPrepPackageJsonPath: scanPrepManifestPath,
          alignmentDeps: alignmentDeps({
            availability: () => ({
              kind: "published",
              version: scanPrepVersion,
            }),
            publishedPin: "0.19.1",
          }),
        }),
      ).resolves.toBeUndefined();
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("rejects scan-prep source drift from published npm dependency via manifest paths", async () => {
    const fixtureDir = mkdtempSync(
      path.join(tmpdir(), "ms-scan-prep-shared-alignment-"),
    );
    const sharedManifestPath = path.join(fixtureDir, "shared-package.json");
    const scanPrepManifestPath = path.join(
      fixtureDir,
      "scan-prep-package.json",
    );
    const scanPrepVersion = "8.8.8-manifest-drift";
    writeFileSync(
      sharedManifestPath,
      `${JSON.stringify({ name: "@mergesignal/shared", version: "0.20.0" }, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      scanPrepManifestPath,
      `${JSON.stringify(
        {
          name: "@mergesignal/scan-prep",
          version: scanPrepVersion,
          dependencies: { "@mergesignal/shared": "0.20.0" },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    try {
      await expect(
        assertScanPrepSourceSharedDependencyAlignsWithReleaseAuthority({
          sharedPackageJsonPath: sharedManifestPath,
          scanPrepPackageJsonPath: scanPrepManifestPath,
          alignmentDeps: alignmentDeps({
            availability: () => ({
              kind: "published",
              version: scanPrepVersion,
            }),
            publishedPin: "0.19.1",
          }),
        }),
      ).rejects.toThrow(
        /must match the published @mergesignal\/scan-prep@8\.8\.8-manifest-drift npmjs dependency/,
      );
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
