import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_ABI,
  FOCAL_ELECTION_DIMENSIONS,
  REACH_SCOPE_MAX_BUCKETS,
  REVIEW_EPISODE_SHAPES,
} from "./assessmentSchema.js";

/** Canonical literals from mergesignal-engine assessment/types.ts */
const ENGINE_REVIEW_EPISODE_SHAPES = [
  "single_anchor",
  "multi_anchor",
  "parent_supporting",
  "coupled_pair",
  "tooling_bundle",
  "structural",
] as const;

const ENGINE_FOCAL_ELECTION_DIMENSIONS = [
  "concern",
  "reach",
  "changeSeverity",
  "role_salience_tiebreak",
] as const;

const ENGINE_REACH_SCOPE_MAX_BUCKETS = [
  "very_low",
  "low",
  "moderate",
  "high",
] as const;

describe("assessment contract parity with engine types.ts", () => {
  it("exports ASSESSMENT_ABI 2 for required focal/scope wire fields", () => {
    expect(ASSESSMENT_ABI).toBe("2");
  });

  it("REVIEW_EPISODE_SHAPES matches engine", () => {
    expect([...REVIEW_EPISODE_SHAPES]).toEqual([
      ...ENGINE_REVIEW_EPISODE_SHAPES,
    ]);
  });

  it("FOCAL_ELECTION_DIMENSIONS matches engine", () => {
    expect([...FOCAL_ELECTION_DIMENSIONS]).toEqual([
      ...ENGINE_FOCAL_ELECTION_DIMENSIONS,
    ]);
  });

  it("REACH_SCOPE_MAX_BUCKETS matches engine", () => {
    expect([...REACH_SCOPE_MAX_BUCKETS]).toEqual([
      ...ENGINE_REACH_SCOPE_MAX_BUCKETS,
    ]);
  });
});
