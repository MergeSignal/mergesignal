# Scan Preparation — Architecture and Privacy Approval Checklist

**Purpose:** Independent sign-off gate before implementation work beyond this API freeze (private collection relocation, public core completion, publication infrastructure).

**Implementation status:** Checklist issued; **Architecture and privacy sign-off completed on 2026-07-21. Commit and PR references remain pending.**. Remove or archive this file after sign-off — see [scan-prep-api.md](./scan-prep-api.md) § Document lifecycle.

---

## Sign-off requirements

Both **architecture review** and **privacy review** are required. A single reviewer may not sign both roles unless explicitly delegated in writing.

| #   | Item                                           | Architecture | Privacy | Notes                                                                                                                                                                                                                            |
| --- | ---------------------------------------------- | :----------: | :-----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mission and ownership approved                 |      ☑       |    ☑    | Public `mergesignal` owns canonical package; engine owns private acquisition                                                                                                                                                     |
| 2   | Public API approved                            |      ☑       |    —    | [scan-prep-api.md](./scan-prep-api.md) root + `./lockfile` tables                                                                                                                                                                |
| 3   | Rejected exports recorded                      |      ☑       |    ☑    | No private acquisition or decision authority on public surface                                                                                                                                                                   |
| 4   | Private collection boundary approved           |      ☑       |    ☑    | [Evidence Collection authority](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/engine/composition/evidence-collection.md)                                                                                      |
| 5   | Privacy boundary approved                      |      ☑       |    ☑    | Public/private split; no engine internals in public docs beyond minimum boundary                                                                                                                                                 |
| 6   | Artifact-identity doctrine approved            |      ☑       |    —    | Permanent invariant documented; enforcement `NOT_YET_ENFORCED`                                                                                                                                                                   |
| 7   | Documentation truth verified                   |      ☑       |    ☑    | Current operating model vs target clearly separated; no false registry-consumption claims                                                                                                                                        |
| 8   | Shared operational authority preserved         |      ☑       |    —    | [SHARED_PACKAGE_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/SHARED_PACKAGE_RELEASE_ORDER.md) operational instructions unchanged; transition pointer to inactive consumption skeleton only |
| 9   | No code or workflow behavior changed in freeze |      ☑       |    ☑    | Docs-only freeze PR                                                                                                                                                                                                              |
| 10  | Version-selection checklist attached           |      ☑       |    —    | [scan-prep-version-selection-checklist.md](./scan-prep-version-selection-checklist.md)                                                                                                                                           |
| 11  | Automation audit reviewed                      |      ☑       |    —    | [PACKAGE_CONSUMPTION_RELEASE_ORDER.md](https://github.com/MergeSignal/mergesignal-engine/blob/main/docs/PACKAGE_CONSUMPTION_RELEASE_ORDER.md)                                                                                    |

---

## Graduation rule

**Private collection relocation, publication infrastructure, and registry consumption must not begin until:**

1. This checklist is complete with independent architecture and privacy approval.
2. Any focused documentation fixes from review are merged.
3. Executable validation for the freeze PR passes.

Completing this checklist does **not** graduate publication or engine migration — it graduates only the API freeze and authority artifacts.

---

## Sign-off record

| Role         | Name         | Date       | Commit / PR |
| ------------ | ------------ | ---------- | ----------- |
| Architecture | Yaron Shafir | 2026-07-21 | Pending     |
| Privacy      | Yaron Shafir | 2026-07-21 | Pending     |

Dual-role authorization: As project owner and authorized maintainer, Yaron Shafir explicitly authorizes and assumes both the Architecture and Privacy reviewer roles for the Scan Preparation Authority Foundation. This dual-role assignment is recorded in writing for this capability. Date: 2026-07-21.
