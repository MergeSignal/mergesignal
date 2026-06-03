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
