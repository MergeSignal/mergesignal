/**
 * Pre-contract engine wire shape (Wave 1/2 drift). Used to assert strict schema rejection
 * and narrative fallback while preserving raw payload for forensics.
 */
export const legacyEngineRepoIntelligenceJwt = {
  packageUsage: [
    {
      name: "jsonwebtoken",
      files: ["src/auth/auth.service.ts", "src/auth/login.controller.ts"],
      reachability: "moderate",
      runtimeSurface: "runtime",
      areas: ["authentication"],
      blastRadius: "moderate",
    },
  ],
  hotspots: [
    {
      file: "src/auth/auth.service.ts",
      fanIn: 2,
      areas: ["authentication"],
    },
  ],
  frameworks: [{ framework: "express", roles: ["middleware"] }],
  blastRadius: {
    level: "large",
    factors: ["reaches runtime application code"],
  },
} as const;
