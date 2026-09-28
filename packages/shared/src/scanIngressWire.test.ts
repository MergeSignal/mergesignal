import { describe, expect, it } from "vitest";

import { buildScanDetailsPresentation } from "./presentation/orchestration/buildScanDetailsPresentation.js";
import { scanResultFastifyRuntime } from "./presentation/fixtures/scanResultFixtures.js";
import {
  computedEvidenceTotalBytes,
  parseGovernedScanProductResponse,
  parseRepositoryEvidenceEnvelope,
  parseSerializableScanAcquiredFacts,
  repositoryCorpusAcquisitionSummarySchema,
  safeParseGovernedScanProductResponse,
  safeParseRepositoryEvidenceEnvelope,
  safeParseSerializableScanAcquiredFacts,
  serializableScanAcquiredFactsSchema,
} from "./scanIngressSchema.js";
import type { GovernedScanProductResponse } from "./scanIngressWire.js";

const SCAN_ID = "11111111-1111-4111-8111-111111111111";

function builtDetailPresentation() {
  const detail = buildScanDetailsPresentation({
    scanId: SCAN_ID,
    pipelineStatus: "done",
    result: scanResultFastifyRuntime,
  });
  expect(detail).not.toBeNull();
  return detail!;
}

describe("SerializableScanAcquiredFacts wire contract", () => {
  const minimal = {
    repoId: "acme/app",
    changeIntent: "change_request" as const,
    headRevision: { sha: "abc123" },
    baseRevision: { ref: "main", sha: "def456" },
    lockfileAtHead: {
      manager: "pnpm" as const,
      content: "lockfileVersion: '9.0'\n",
      path: "pnpm-lock.yaml",
    },
    changedPaths: ["src/index.ts"],
    changedManifestPaths: ["package.json"],
    acquisitionWarnings: [
      { code: "base_lockfile_missing", message: "example" },
    ],
  };

  it("round-trips through JSON", () => {
    const parsed = parseSerializableScanAcquiredFacts(minimal);
    const json = JSON.stringify(parsed);
    const again = parseSerializableScanAcquiredFacts(JSON.parse(json));
    expect(again).toEqual(parsed);
  });

  it("rejects non-JSON-serializable shapes at schema boundary", () => {
    const withMap = {
      ...minimal,
      bad: new Map([["a", "b"]]),
    };
    expect(safeParseSerializableScanAcquiredFacts(withMap).success).toBe(false);
  });

  it("rejects local runtime fields on wire schema", () => {
    const withRoot = {
      ...minimal,
      repositoryRoot: "/tmp/repo",
    };
    expect(safeParseSerializableScanAcquiredFacts(withRoot).success).toBe(
      false,
    );
  });

  it("rejects inline source corpus on acquired facts", () => {
    const withCorpus = {
      ...minimal,
      sourceCorpus: { "src/a.ts": "code" },
    };
    expect(safeParseSerializableScanAcquiredFacts(withCorpus).success).toBe(
      false,
    );
  });

  it("does not accept provider orchestration metadata", () => {
    const withGithub = {
      ...minimal,
      github: { prNumber: 1 },
    };
    expect(safeParseSerializableScanAcquiredFacts(withGithub).success).toBe(
      false,
    );
  });
});

describe("RepositoryEvidenceEnvelope", () => {
  it("validates independently with version and files map", () => {
    const envelope = {
      schemaVersion: 1,
      files: { "src/index.ts": "export {}" },
      reportedAcquisitionSummary: {
        filesIncluded: 1,
        filesSkippedPolicy: 0,
        filesSkippedSize: 0,
        filesSkippedBinary: 0,
        totalBytes: 12,
        truncated: false,
      },
    };
    const parsed = parseRepositoryEvidenceEnvelope(envelope);
    expect(parsed.schemaVersion).toBe(1);
    expect(computedEvidenceTotalBytes(parsed.files)).toBeGreaterThan(0);
  });

  it("rejects storage-provider fields", () => {
    const bad = {
      schemaVersion: 1,
      files: {},
      reportedAcquisitionSummary: {
        filesIncluded: 0,
        filesSkippedPolicy: 0,
        filesSkippedSize: 0,
        filesSkippedBinary: 0,
        totalBytes: 0,
        truncated: false,
      },
      objectKey: "evidence/scan-1",
      bucket: "secrets",
    };
    expect(safeParseRepositoryEvidenceEnvelope(bad).success).toBe(false);
  });

  it("rejects malformed envelope", () => {
    expect(
      safeParseRepositoryEvidenceEnvelope({ schemaVersion: 2 }).success,
    ).toBe(false);
  });

  it("does not treat reported totalBytes as validation authority", () => {
    const files = { "src/a.ts": "€" };
    const actualBytes = computedEvidenceTotalBytes(files);
    expect(actualBytes).toBe(3);
    const envelope = parseRepositoryEvidenceEnvelope({
      schemaVersion: 1,
      files,
      reportedAcquisitionSummary: {
        filesIncluded: 1,
        filesSkippedPolicy: 0,
        filesSkippedSize: 0,
        filesSkippedBinary: 0,
        totalBytes: 999_999,
        truncated: false,
      },
    });
    expect(envelope.reportedAcquisitionSummary.totalBytes).toBe(999_999);
    expect(actualBytes).toBe(3);
  });
});

describe("RepositoryCorpusAcquisitionSummary", () => {
  it("represents truncated collection honestly", () => {
    const summary = {
      filesIncluded: 10,
      filesSkippedPolicy: 3,
      filesSkippedSize: 2,
      filesSkippedBinary: 1,
      totalBytes: 50_000,
      truncated: true,
      corpusIgnorePolicyPartial: true,
    };
    const envelope = parseRepositoryEvidenceEnvelope({
      schemaVersion: 1,
      files: { "src/a.ts": "//" },
      reportedAcquisitionSummary: summary,
    });
    expect(envelope.reportedAcquisitionSummary.truncated).toBe(true);
    expect(envelope.reportedAcquisitionSummary.corpusIgnorePolicyPartial).toBe(
      true,
    );
  });

  it("rejects unknown summary keys", () => {
    expect(
      repositoryCorpusAcquisitionSummarySchema.safeParse({
        filesIncluded: 1,
        filesSkippedPolicy: 0,
        filesSkippedSize: 0,
        filesSkippedBinary: 0,
        totalBytes: 1,
        truncated: false,
        extraField: true,
      }).success,
    ).toBe(false);
  });
});

describe("computedEvidenceTotalBytes", () => {
  it("counts UTF-8 bytes, not JavaScript string length", () => {
    expect(computedEvidenceTotalBytes({ "x.ts": "€" })).toBe(3);
    expect("€".length).toBe(1);
  });
});

describe("ScanOperationalOutcome", () => {
  it("cannot include Assessment authority fields", () => {
    expect(() =>
      parseGovernedScanProductResponse({
        kind: "operational",
        outcome: {
          kind: "no_dependency_upgrade_episode",
          scanId: "s1",
          repoId: "acme/app",
          explanationCode: "no_upgrade_episode",
          message: "No dependency transition verified.",
          posture: "safe",
        },
      }),
    ).toThrow(/posture|Assessment authority|Unrecognized key/);
  });

  it("accepts governed operational kinds", () => {
    const operational: GovernedScanProductResponse = {
      kind: "operational",
      outcome: {
        kind: "change_context_unavailable",
        scanId: "s2",
        repoId: "acme/app",
        explanationCode: "change_context_unavailable",
        message: "Base revision could not be established.",
      },
    };
    expect(parseGovernedScanProductResponse(operational)).toEqual(operational);
  });
});

describe("GovernedScanProductResponse", () => {
  it("discriminates operational vs analysis_complete", () => {
    const operational = parseGovernedScanProductResponse({
      kind: "operational",
      outcome: {
        kind: "no_dependency_upgrade_episode",
        scanId: "s1",
        repoId: "o/r",
        explanationCode: "no_upgrade_episode",
        message: "ok",
      },
    });
    expect(operational.kind).toBe("operational");

    const detail = builtDetailPresentation();
    const complete = parseGovernedScanProductResponse({
      kind: "analysis_complete",
      scanId: SCAN_ID,
      detailPresentation: detail,
    });
    expect(complete.kind).toBe("analysis_complete");
  });

  it("rejects incomplete analysis_complete presentation", () => {
    expect(
      safeParseGovernedScanProductResponse({
        kind: "analysis_complete",
        scanId: SCAN_ID,
        detailPresentation: {
          status: "safe",
          hero: {
            headline: "h",
            verdictLine: "v",
            postureLabel: "Safe",
          },
          narrative: { keyPoints: [], changedPackages: [] },
          metadata: { scanId: SCAN_ID },
        },
      }).success,
    ).toBe(false);
  });

  it("rejects raw ScanResult-shaped payloads at response boundary", () => {
    expect(
      safeParseGovernedScanProductResponse({
        kind: "analysis_complete",
        scanId: SCAN_ID,
        result: { assessment: {} },
      }).success,
    ).toBe(false);
  });

  it("rejects collectionContext on product response", () => {
    const detail = builtDetailPresentation();
    expect(
      safeParseGovernedScanProductResponse({
        kind: "analysis_complete",
        scanId: SCAN_ID,
        collectionContext: { secret: true },
        detailPresentation: detail,
      }).success,
    ).toBe(false);
  });

  it("rejects private payloads nested in detailPresentation", () => {
    const detail = builtDetailPresentation();
    expect(
      safeParseGovernedScanProductResponse({
        kind: "analysis_complete",
        scanId: SCAN_ID,
        detailPresentation: {
          ...detail,
          result: { assessment: {} },
        },
      }).success,
    ).toBe(false);
    expect(
      safeParseGovernedScanProductResponse({
        kind: "analysis_complete",
        scanId: SCAN_ID,
        detailPresentation: {
          ...detail,
          collectionContext: { secret: true },
        },
      }).success,
    ).toBe(false);
  });

  it("rejects extra keys on governed response arms", () => {
    expect(
      safeParseGovernedScanProductResponse({
        kind: "operational",
        outcome: {
          kind: "no_dependency_upgrade_episode",
          scanId: "s1",
          repoId: "o/r",
          explanationCode: "x",
          message: "ok",
        },
        assessment: {},
      }).success,
    ).toBe(false);
  });
});

describe("ScanQueueJob contract extension", () => {
  it("allows acquired facts on job type via schema composition", () => {
    const job = {
      scanId: "id",
      repoId: "o/r",
      dependencyGraph: {},
      changeIntent: "change_request" as const,
      acquiredFacts: {
        repoId: "o/r",
        changeIntent: "change_request" as const,
        headRevision: { sha: "abc" },
      },
    };
    expect(
      serializableScanAcquiredFactsSchema.parse(job.acquiredFacts).repoId,
    ).toBe("o/r");
  });
});
