import { describe, expect, it } from "vitest";

import {
  LOCKFILE_UNCERTAINTY_WARNING_CODES,
  PREPARATION_UNCERTAINTY_WARNING_CODES,
  hasLockfileUncertaintyWarnings,
  hasPreparationUncertaintyWarnings,
  isLockfileUncertaintyWarningCode,
  isPreparationUncertaintyWarning,
} from "./lockfileEvidence.js";
import type { AnalysisContextWarning } from "./types.js";

function warning(
  code: AnalysisContextWarning["code"],
  message = "test",
): AnalysisContextWarning {
  return { code, message };
}

describe("lockfile evidence uncertainty helpers", () => {
  it("recognizes every lockfile uncertainty warning code", () => {
    for (const code of LOCKFILE_UNCERTAINTY_WARNING_CODES) {
      expect(isLockfileUncertaintyWarningCode(code)).toBe(true);
      expect(hasLockfileUncertaintyWarnings([warning(code)])).toBe(true);
    }
  });

  it("recognizes every preparation uncertainty warning code", () => {
    for (const code of PREPARATION_UNCERTAINTY_WARNING_CODES) {
      expect(isPreparationUncertaintyWarning(warning(code))).toBe(true);
      expect(hasPreparationUncertaintyWarnings([warning(code)])).toBe(true);
    }
  });

  it("does not treat informational warnings as uncertainty", () => {
    expect(isLockfileUncertaintyWarningCode("code_fetch_skipped")).toBe(false);
    expect(
      hasPreparationUncertaintyWarnings([warning("code_fetch_skipped")]),
    ).toBe(false);
    expect(
      hasLockfileUncertaintyWarnings([
        warning("package_change_ingress_rejected"),
      ]),
    ).toBe(false);
  });

  it("does not recognize retired lockfile_diff_empty as uncertainty", () => {
    expect(isLockfileUncertaintyWarningCode("lockfile_diff_empty")).toBe(false);
    expect(
      hasLockfileUncertaintyWarnings([
        warning("lockfile_diff_empty" as AnalysisContextWarning["code"]),
      ]),
    ).toBe(false);
  });

  it("returns false for unknown warning codes", () => {
    expect(isLockfileUncertaintyWarningCode("not_a_real_code")).toBe(false);
    expect(
      hasPreparationUncertaintyWarnings([
        {
          code: "not_a_real_code" as AnalysisContextWarning["code"],
          message: "x",
        },
      ]),
    ).toBe(false);
  });

  it("handles empty warnings", () => {
    expect(hasLockfileUncertaintyWarnings([])).toBe(false);
    expect(hasPreparationUncertaintyWarnings([])).toBe(false);
  });

  it("detects mixed informational and uncertainty warnings", () => {
    expect(
      hasPreparationUncertaintyWarnings([
        warning("code_fetch_skipped"),
        warning("lockfile_evidence_incomplete"),
      ]),
    ).toBe(true);
    expect(
      hasLockfileUncertaintyWarnings([
        warning("code_fetch_skipped"),
        warning("lockfile_head_missing"),
      ]),
    ).toBe(true);
  });
});
