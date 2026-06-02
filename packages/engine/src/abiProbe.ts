import type { CodeAnalysisInput, ScanRequest } from "@mergesignal/shared";

/** Lightweight corpus probe for ABI validation (no GitHub I/O). */
export const ABI_PROBE_CODE_ANALYSIS: CodeAnalysisInput = {
  fileContents: new Map([
    [
      "src/index.ts",
      "import express from 'express';\nexport const app = express();\n",
    ],
  ]),
  changedPackages: ["express"],
};

export const ABI_PROBE_SCAN_REQUEST_WITH_PACKAGES: ScanRequest = {
  repoId: "__mergesignal_engine_abi_probe__",
  dependencyGraph: {},
  changedPackages: ["express"],
  lockfilePackageDelta: { added: [], removed: [], updated: ["express"] },
};
