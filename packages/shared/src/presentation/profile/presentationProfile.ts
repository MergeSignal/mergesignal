import type {
  PresentationConfidence,
  PresentationDensity,
  PresentationPriority,
  PresentationStatus,
} from "../dto/types.js";

export type PresentationProfile = {
  status: PresentationStatus;
  density: PresentationDensity;
  confidence: PresentationConfidence;
  priority: PresentationPriority;
  degradedMessage?: string;
};
