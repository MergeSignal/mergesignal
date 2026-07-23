/**
 * Structured pnpm-lock.yaml validation for published-registry consumer smoke installs.
 */

type PublishedRegistryLockfileExpectation = {
  scanPrepPackageName: string;
  scanPrepVersion: string;
  sharedVersion: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractIndentedBlock(lock: string, entryKey: string): string {
  const marker = `${entryKey}:\n`;
  const start = lock.indexOf(marker);
  if (start === -1) {
    throw new Error(`lockfile missing ${entryKey}`);
  }

  const lines = lock.slice(start + marker.length).split("\n");
  const blockLines: string[] = [];
  for (const line of lines) {
    if (blockLines.length > 0 && /^  '[^']+':\s*$/.test(line)) {
      break;
    }
    blockLines.push(line);
  }
  return blockLines.join("\n");
}

function assertImporterRegistryVersion(
  lock: string,
  packageName: string,
  version: string,
): void {
  const pattern = new RegExp(
    `'${escapeRegExp(packageName)}':\\s*\\n\\s+specifier:[^\\n]*\\n\\s+version:\\s*([^\\n]+)`,
    "m",
  );
  const match = lock.match(pattern);
  if (!match) {
    throw new Error(`lockfile missing importer entry for ${packageName}`);
  }

  const importerVersion = match[1]?.trim() ?? "";
  if (/^(?:link|file|workspace|catalog):/i.test(importerVersion)) {
    throw new Error(
      `lockfile must not use local or workspace protocol for ${packageName} (got: ${importerVersion})`,
    );
  }
  if (importerVersion !== version) {
    throw new Error(
      `lockfile importer version mismatch for ${packageName} (expected ${version}, got ${importerVersion})`,
    );
  }
}

function assertPackagesRegistryResolution(
  lock: string,
  packageName: string,
  version: string,
): void {
  const packageKey = `'${packageName}@${version}'`;
  const block = extractIndentedBlock(lock, packageKey);

  if (/npm\.pkg\.github\.com/i.test(block)) {
    throw new Error(
      `lockfile must not reference GitHub Packages for ${packageName}`,
    );
  }
  if (/(?:^|\n)\s+resolution:\s*\{[^}]*\b(?:link|file):/m.test(block)) {
    throw new Error(`lockfile must not use link:/file: for ${packageName}`);
  }
  if (!/integrity:\s*sha512-/i.test(block)) {
    throw new Error(
      `lockfile missing registry integrity for ${packageName}@${version}`,
    );
  }
}

function assertNoLocalProtocolPackageKeys(
  lock: string,
  packageName: string,
): void {
  const pattern = new RegExp(
    `'${escapeRegExp(packageName)}@(?:link|file):`,
    "i",
  );
  if (pattern.test(lock)) {
    throw new Error(`lockfile must not use link:/file: for ${packageName}`);
  }
}

export function assertPublishedRegistryConsumerLockfile(
  lock: string,
  expected: PublishedRegistryLockfileExpectation,
): void {
  if (/npm\.pkg\.github\.com/i.test(lock)) {
    throw new Error("lockfile must not reference GitHub Packages");
  }

  assertImporterRegistryVersion(
    lock,
    expected.scanPrepPackageName,
    expected.scanPrepVersion,
  );
  assertImporterRegistryVersion(
    lock,
    "@mergesignal/shared",
    expected.sharedVersion,
  );

  assertPackagesRegistryResolution(
    lock,
    expected.scanPrepPackageName,
    expected.scanPrepVersion,
  );
  assertPackagesRegistryResolution(
    lock,
    "@mergesignal/shared",
    expected.sharedVersion,
  );

  assertNoLocalProtocolPackageKeys(lock, expected.scanPrepPackageName);
  assertNoLocalProtocolPackageKeys(lock, "@mergesignal/shared");
}
