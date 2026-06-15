import type {
  AffectedAreaFact,
  ChangedPackageSemantics,
  NarrativePackageUsage,
  PackageEvidenceStrength,
  ScanNarrativeFacts,
} from "./scanNarrativeFacts.js";
import type { Finding } from "./types.js";

const EVIDENCE_STRENGTH_RANK: Record<PackageEvidenceStrength, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function areaIdFromLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "_").slice(0, 48);
}

function packagesForArea(
  area: Pick<AffectedAreaFact, "id" | "label">,
  packageUsage: NarrativePackageUsage[],
  applicationAreaIds: ReadonlySet<string>,
): string[] {
  const linked = new Set<string>();

  for (const row of packageUsage) {
    for (const usageArea of row.areas) {
      if (
        areaIdFromLabel(usageArea) === area.id ||
        usageArea.toLowerCase() === area.label.toLowerCase()
      ) {
        linked.add(row.packageName);
      }
    }
  }

  if (applicationAreaIds.has(area.id)) {
    for (const row of packageUsage) {
      linked.add(row.packageName);
    }
  }

  return [...linked].sort((a, b) => a.localeCompare(b));
}

function findingIdsForPackages(
  findings: Finding[],
  packages: string[],
): string[] {
  if (packages.length === 0) return [];
  const pkgSet = new Set(packages);
  return findings.filter((f) => pkgSet.has(f.packageName)).map((f) => f.id);
}

function pathsForPackages(
  packageUsage: NarrativePackageUsage[],
  packages: string[],
): string[] {
  const pkgSet = new Set(packages);
  const paths: string[] = [];
  for (const row of packageUsage) {
    if (!pkgSet.has(row.packageName)) continue;
    paths.push(...row.paths, ...row.criticalPaths, ...row.files);
  }
  const seen = new Set<string>();
  return paths.filter((p) => {
    if (!p || seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

function evidenceStrengthForPackages(
  semantics: ChangedPackageSemantics[],
  packages: string[],
): PackageEvidenceStrength | null {
  const pkgSet = new Set(packages);
  let best: PackageEvidenceStrength | null = null;
  let bestRank = 0;
  for (const row of semantics) {
    if (!pkgSet.has(row.packageName) || !row.evidenceStrength) continue;
    const rank = EVIDENCE_STRENGTH_RANK[row.evidenceStrength];
    if (rank > bestRank) {
      bestRank = rank;
      best = row.evidenceStrength;
    }
  }
  return best;
}

function hotspotPackagesForPackages(
  hotspots: ScanNarrativeFacts["hotspots"],
  packages: string[],
): string[] {
  const pkgSet = new Set(packages);
  const linked = new Set<string>();
  for (const hotspot of hotspots) {
    if (pkgSet.has(hotspot.packageName)) {
      linked.add(hotspot.packageName);
    }
  }
  return [...linked].sort((a, b) => a.localeCompare(b));
}

function verificationFocusForPackages(
  semantics: ChangedPackageSemantics[],
  packages: string[],
): string[] {
  const pkgSet = new Set(packages);
  const focus = new Set<string>();
  for (const row of semantics) {
    if (!pkgSet.has(row.packageName)) continue;
    for (const item of row.verificationFocus) {
      if (item.trim()) focus.add(item.trim());
    }
  }
  return [...focus].sort((a, b) => a.localeCompare(b));
}

export function enrichAffectedAreaFacts(
  areas: Array<{ id: string; label: string }>,
  ctx: {
    findings: Finding[];
    packageUsage: NarrativePackageUsage[];
    changedPackageSemantics: ChangedPackageSemantics[];
    hotspots: ScanNarrativeFacts["hotspots"];
    applicationAreaIds: ReadonlySet<string>;
  },
): AffectedAreaFact[] {
  return areas.map((area) => {
    const packages = packagesForArea(
      area,
      ctx.packageUsage,
      ctx.applicationAreaIds,
    );
    return {
      id: area.id,
      label: area.label,
      packages,
      findingIds: findingIdsForPackages(ctx.findings, packages),
      paths: pathsForPackages(ctx.packageUsage, packages),
      evidenceStrength: evidenceStrengthForPackages(
        ctx.changedPackageSemantics,
        packages,
      ),
      hotspotPackages: hotspotPackagesForPackages(ctx.hotspots, packages),
      verificationFocus: verificationFocusForPackages(
        ctx.changedPackageSemantics,
        packages,
      ),
    };
  });
}
