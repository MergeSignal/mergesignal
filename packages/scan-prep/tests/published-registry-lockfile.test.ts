import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { assertPublishedRegistryConsumerLockfile } from "../../../scripts/ci/lib/scan-prep-published-registry-lockfile.ts";

const PACKAGE_NAME = "@mergesignal/scan-prep";
const VERSION = "0.1.0";
const SHARED_VERSION = "0.13.0";

const VALID_LOCKFILE = readFileSync(
  path.join(
    import.meta.dirname,
    "fixtures/published-registry-consumer.lock.yaml",
  ),
  "utf8",
);

function expectLockfilePass(lock: string): void {
  expect(() =>
    assertPublishedRegistryConsumerLockfile(lock, {
      scanPrepPackageName: PACKAGE_NAME,
      scanPrepVersion: VERSION,
      sharedVersion: SHARED_VERSION,
    }),
  ).not.toThrow();
}

function expectLockfileFail(lock: string, message: RegExp): void {
  expect(() =>
    assertPublishedRegistryConsumerLockfile(lock, {
      scanPrepPackageName: PACKAGE_NAME,
      scanPrepVersion: VERSION,
      sharedVersion: SHARED_VERSION,
    }),
  ).toThrow(message);
}

describe("published-registry consumer lockfile validation", () => {
  it("accepts npmjs registry resolutions with pnpm excludeLinksFromLockfile setting", () => {
    expectLockfilePass(VALID_LOCKFILE);
  });

  it("rejects a real link: resolution for @mergesignal/scan-prep", () => {
    const lock = VALID_LOCKFILE.replace(
      '"@mergesignal/scan-prep@0.1.0":',
      '"@mergesignal/scan-prep@link:../../packages/scan-prep":',
    ).replace(
      'version: 0.1.0\n      "@mergesignal/shared":',
      'version: link:../../packages/scan-prep\n      "@mergesignal/shared":',
    );

    expectLockfileFail(lock, /link:\/file:|local or workspace protocol/);
  });

  it("rejects a real file: resolution for @mergesignal/shared", () => {
    const lock = VALID_LOCKFILE.replace(
      '"@mergesignal/shared@0.13.0":',
      '"@mergesignal/shared@file:../shared":',
    ).replace(
      "version: 0.13.0\n    devDependencies:",
      "version: file:../shared\n    devDependencies:",
    );

    expectLockfileFail(lock, /link:\/file:|local or workspace protocol/);
  });

  it("rejects GitHub Packages registry references", () => {
    const lock = VALID_LOCKFILE.replace(
      "integrity: sha512-KHBKRtwPFV65s3GAqj/UjbCjWZGnO9WUfyBAUjBJ//iIIK/lBnjj9F1sFiexZ66A34tiZbJcakGoDVPkSFaRrg==",
      "tarball: https://npm.pkg.github.com/download/@mergesignal/scan-prep/0.1.0",
    );

    expectLockfileFail(lock, /GitHub Packages/);
  });

  it("rejects registry packages missing integrity metadata", () => {
    const lock = VALID_LOCKFILE.replace(
      "integrity: sha512-Oijj2VwquFKy8j3r1XgN0Jvt0RqVnUcHLGznOh8nt4L5ukP9MrCVpEKo6r7dvVIL49ZylE6NfI5NgP/44pajEw==",
      "",
    );

    expectLockfileFail(lock, /missing registry integrity/);
  });
});
