import type {
  PresentationConfidence,
  PresentationDensity,
  PresentationPriority,
  PresentationStatus,
} from "../dto/types.js";
import type { PresentationInterpretation } from "../intent/presentationIntent.js";

export type PresentationProfile = {
  status: PresentationStatus;
  density: PresentationDensity;
  confidence: PresentationConfidence;
  priority: PresentationPriority;
  degradedMessage?: string;
  interpretation: PresentationInterpretation;
};
