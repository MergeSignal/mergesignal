/**
 * npmjs version availability for @mergesignal/shared (thin adapter).
 */
import { classifyNpmjsPackageVersionAvailability } from "./npmjs-package-version-availability.ts";

export const SHARED_PACKAGE_NAME = "@mergesignal/shared";

export function classifyNpmjsSharedVersionAvailability(
  version: string,
): ReturnType<typeof classifyNpmjsPackageVersionAvailability> {
  return classifyNpmjsPackageVersionAvailability(SHARED_PACKAGE_NAME, version);
}
