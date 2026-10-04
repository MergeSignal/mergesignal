import { z } from "zod";

/** Governed evidence-completeness vocabulary for wire and collection metadata. */
export const COMPLETENESS_STATES = [
  "complete",
  "incomplete",
  "unknown",
] as const;

export type CompletenessState = (typeof COMPLETENESS_STATES)[number];

/** Strict runtime validation for {@link CompletenessState}. No default or coercion. */
export const completenessStateSchema = z.enum(COMPLETENESS_STATES);
