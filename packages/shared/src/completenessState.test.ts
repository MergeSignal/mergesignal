import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  COMPLETENESS_STATES,
  completenessStateSchema,
  type CompletenessState,
} from "./completenessState.js";

describe("COMPLETENESS_STATES", () => {
  it("defines the governed vocabulary", () => {
    expect(COMPLETENESS_STATES).toEqual(["complete", "incomplete", "unknown"]);
  });
});

describe("completenessStateSchema", () => {
  it.each(["complete", "incomplete", "unknown"] satisfies CompletenessState[])(
    "accepts %s",
    (value) => {
      expect(completenessStateSchema.parse(value)).toBe(value);
    },
  );

  it("rejects arbitrary strings", () => {
    expect(completenessStateSchema.safeParse("partial").success).toBe(false);
    expect(completenessStateSchema.safeParse("").success).toBe(false);
  });

  it("rejects booleans", () => {
    expect(completenessStateSchema.safeParse(true).success).toBe(false);
    expect(completenessStateSchema.safeParse(false).success).toBe(false);
  });

  it("rejects null", () => {
    expect(completenessStateSchema.safeParse(null).success).toBe(false);
  });

  it("rejects undefined when the state is required", () => {
    expect(completenessStateSchema.safeParse(undefined).success).toBe(false);

    const requiredField = z.object({ state: completenessStateSchema });
    expect(requiredField.safeParse({}).success).toBe(false);
    expect(requiredField.safeParse({ state: undefined }).success).toBe(false);
  });

  it("does not apply an implicit complete default", () => {
    const withOptionalBare = completenessStateSchema.optional();
    expect(withOptionalBare.safeParse(undefined).success).toBe(true);
    expect(withOptionalBare.safeParse(undefined).data).toBeUndefined();

    const requiredField = z.object({ state: completenessStateSchema });
    const missing = requiredField.safeParse({});
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues.some((i) => i.path.includes("state"))).toBe(
        true,
      );
    }
  });
});
