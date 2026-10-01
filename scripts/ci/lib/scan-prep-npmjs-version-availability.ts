/**
 * npmjs version availability for @mergesignal/scan-prep (thin adapter).
 */
import { classifyNpmjsPackageVersionAvailability } from "./npmjs-package-version-availability.ts";

export const PACKAGE_NAME = "@mergesignal/scan-prep";

export function classifyNpmjsScanPrepVersionAvailability(
  version: string,
): ReturnType<typeof classifyNpmjsPackageVersionAvailability> {
  return classifyNpmjsPackageVersionAvailability(PACKAGE_NAME, version);
}
