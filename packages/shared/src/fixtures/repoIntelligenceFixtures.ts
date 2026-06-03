import type { RepoIntelligence } from "../repoIntelligenceSchema.js";

/** Corpus-enabled runtime framework upgrade (auth/API paths). */
export const fixtureRepoIntelligenceFastify: RepoIntelligence = {
  packages: {
    fastify: {
      runtimeSurface: "runtime",
      reachability: "on_runtime_paths",
      usage: {
        packageName: "fastify",
        paths: ["apps/api/src/server.ts", "apps/api/src/routes/account.ts"],
        criticalPaths: ["apps/api/src/middleware/auth.ts"],
        areas: ["API", "Auth middleware"],
      },
    },
  },
  blastRadius: {
    level: "moderate",
    factors: ["middleware_ordering", "route_handlers"],
    changedPackageCount: 1,
  },
  applicationAreas: [
    { id: "api", label: "API routes" },
    { id: "auth", label: "Auth middleware" },
  ],
  hotspots: [
    {
      packageName: "fastify",
      source: "code",
      paths: ["apps/api/src/middleware/auth.ts"],
    },
  ],
  frameworks: ["fastify"],
};

/** Build-only toolchain change — no runtime paths. */
export const fixtureRepoIntelligenceTypescript: RepoIntelligence = {
  packages: {
    typescript: {
      runtimeSurface: "build",
      reachability: "build_only",
    },
  },
  blastRadius: { level: "narrow", changedPackageCount: 1 },
  applicationAreas: [],
};

/** Empty corpus stub (engine-test-fixture default). */
export const fixtureRepoIntelligenceEmpty: RepoIntelligence = {
  packages: {},
};

/** Multi-package PR with distinct usage per package. */
export const fixtureRepoIntelligenceMultiPackage: RepoIntelligence = {
  packages: {
    lodash: {
      runtimeSurface: "runtime",
      reachability: "on_runtime_paths",
      usage: {
        packageName: "lodash",
        paths: ["apps/billing/export.ts"],
        areas: ["Billing"],
      },
    },
    axios: {
      runtimeSurface: "runtime",
      reachability: "on_runtime_paths",
      usage: {
        packageName: "axios",
        paths: ["apps/api/client.ts"],
        areas: ["API"],
      },
    },
  },
  packageUsage: [
    {
      packageName: "lodash",
      paths: ["apps/billing/export.ts"],
    },
    {
      packageName: "axios",
      paths: ["apps/api/client.ts"],
    },
  ],
  blastRadius: {
    level: "moderate",
    factors: ["multiple_runtime_consumers", "shared_middleware"],
    changedPackageCount: 2,
  },
  frameworks: ["express", "react"],
  hotspots: [
    {
      packageName: "lodash",
      source: "code",
      paths: ["apps/billing/export.ts"],
    },
  ],
};
