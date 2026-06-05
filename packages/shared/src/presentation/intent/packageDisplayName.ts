import type { PackageRoleKind } from "../../scanNarrativeFacts.js";

const ROLE_DISPLAY: Partial<Record<PackageRoleKind, string>> = {
  typechecker: "TypeScript",
  linter: "ESLint",
  formatter: "Prettier",
  test_runner: "Test runner",
};

/** Display name from package role when engine classified it; else title-case package name. */
export function formatPackageDisplayName(
  packageName: string,
  packageRole?: PackageRoleKind | null,
): string {
  if (packageRole && ROLE_DISPLAY[packageRole]) {
    return ROLE_DISPLAY[packageRole]!;
  }
  if (!packageName) return packageName;
  if (packageName.length <= 3) return packageName.toUpperCase();
  return packageName.charAt(0).toUpperCase() + packageName.slice(1);
}
