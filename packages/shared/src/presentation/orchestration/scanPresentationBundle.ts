import type { ScanNarrativeFacts } from "../../scanNarrativeFacts.js";
import type { ScanResult } from "../../types.js";
import type { PresentationProfile } from "../profile/presentationProfile.js";

export type ScanPresentationBundle = {
  facts: ScanNarrativeFacts;
  profile: PresentationProfile;
  /**
   * Projection-only reference to the raw scan payload.
   * Presenters may read fields for formatting but must NOT re-derive interpretation.
   */
  result: ScanResult;
  /** Extension point for future shared derived artifacts */
  shared?: Record<string, unknown>;
};
