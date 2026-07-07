import type {
  Assessment,
  AssessmentPresentationPublic,
  AuthoredCommunicationAccessors,
} from "@mergesignal/contracts";
import type { ScanNarrativeFacts } from "../../scanNarrativeFacts.js";
import type { ScanResult } from "../../types.js";
import type { PresentationProfile } from "../profile/presentationProfile.js";

export type ScanPresentationBundle = AuthoredCommunicationAccessors & {
  assessment: Assessment;
  presentation: AssessmentPresentationPublic;
  profile: PresentationProfile;
  /**
   * Evidence layout only — not an authority for posture, concern, or intensity.
   * @deprecated Prefer bundle accessors for authored communication; V3 migration only.
   */
  facts: ScanNarrativeFacts;
  /**
   * Projection-only reference to the raw scan payload.
   * @deprecated V3 migration only — surfaces must use accessors for decision meaning.
   */
  result: ScanResult;
};
