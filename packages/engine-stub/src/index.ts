// This is a stub - actual implementation is private
export { analyze, simulateUpgrade } from "./stub.js";

// Re-export types from shared package for API contracts
export type {
  ScanRequest,
  ScanResult,
  UpgradeSimulationRequest,
  UpgradeSimulationResult,
  Finding,
  RiskSignal,
  Recommendation,
  ScoreLayer,
  LayerScores,
  ScoreContribution,
  UpgradeSimulationDelta,
  UpgradeSimulationImpact,
} from "@mergesignal/shared";

// Code analysis types (stub interfaces - implementations are private)
export type ImportLocation = {
  file: string;
  line: number;
  column: number;
  importStatement: string;
};

export type ImportScanResult = {
  packageName: string;
  locations: ImportLocation[];
};

export type ImportedSymbol = {
  name: string;
  isDefault: boolean;
  isNamespace: boolean;
  alias?: string;
};

export type ImportAnalysis = {
  file: string;
  imports: Array<{
    packageName: string;
    symbols: ImportedSymbol[];
    line: number;
  }>;
};

export type DetailedUsageReport = {
  packageName: string;
  isUsed: boolean;
  importedIn: string[];
  symbolsUsed: Set<string>;
  usageCount: number;
};

// Stub functions for code analysis (throw errors if called)
export function analyzePackageUsage(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function analyzeMultiplePackageUsage(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function analyzePackageUsageDetailed(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function buildFileContentsMap(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function scanForImports(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function scanForMultipleImports(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function extractPackageName(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function parseImportSymbols(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function parseMultipleImports(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function extractUniqueSymbols(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function assessCriticalPath(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function categorizeFilesByCriticality(): never {
  throw new Error("Code analysis not available in open-source version.");
}

export function extractCriticalPathIndicators(): never {
  throw new Error("Code analysis not available in open-source version.");
}
