import type {
  Assessment,
  AssessmentPresentationPublic,
} from "@mergesignal/contracts";
import type { ScanNarrativeFacts } from "../../scanNarrativeFacts.js";
import type { ScanResult } from "../../types.js";
import type { PresentationProfile } from "../profile/presentationProfile.js";

export type ScanPresentationBundle = {
  assessment: Assessment;
  presentation: AssessmentPresentationPublic;
  profile: PresentationProfile;
  /**
   * Evidence layout only — not an authority for posture, concern, or intensity.
   * @deprecated Prefer assessment + repoIntelligence on result for new code.
   */
  facts: ScanNarrativeFacts;
  /**
   * Projection-only reference to the raw scan payload.
   * Presenters may read fields for formatting but must NOT re-derive interpretation.
   */
  result: ScanResult;
};
