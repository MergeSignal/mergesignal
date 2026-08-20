# MergeSignal scan decision states

This document is the **canonical public explanation** of MergeSignal dependency-review decisions. API fields, GitHub Checks, CLI output, and dashboard cards use the same four values on `ScanResult.decision.recommendation` (wire vocabulary: `safe`, `needs_review`, `risky`, `indeterminate`).

Human-readable label for `indeterminate`: **Cannot determine** (see `@mergesignal/shared` `MERGE_POSTURE_LABEL`).

## Quick reference

| Wire value      | Display label    | Summary                                                                   |
| --------------- | ---------------- | ------------------------------------------------------------------------- |
| `safe`          | Safe             | Sufficient evidence to clear the upgrade under supported analysis scope   |
| `needs_review`  | Needs review     | Concrete, repository-relevant concern with bounded verification           |
| `risky`         | Risky            | Negative evidence of incompatibility or breakage                          |
| `indeterminate` | Cannot determine | Honest abstention — not safe, not a review assignment, not a risk finding |

## Safe

**Meaning:** MergeSignal has sufficient evidence to clear the dependency upgrade under the supported analysis scope.

Important:

- This is **evidence-backed clearance**, not simply “no problem found.”
- **Absence of evidence is not sufficient for Safe.** If MergeSignal cannot establish clearance, the result is not Safe.

**Developer implication:** No MergeSignal-specific dependency review is required beyond your team's normal engineering process.

## Needs review

**Meaning:** MergeSignal found a **concrete, material, repository-relevant** reason the dependency upgrade may affect this repository, but the condition is **not proven broken**.

This outcome is accompanied by **bounded verification** — specific checks describing what should be verified (what changed, where it matters, and what to confirm).

Important:

- This is **not generic uncertainty.**
- There is a real **evidence-backed concern.**
- MergeSignal identifies **what** to verify, not open-ended “investigate this package” homework.

**Developer implication:** Perform the bounded verification MergeSignal identifies.

## Risky

**Meaning:** MergeSignal has **negative evidence** establishing incompatibility or breakage under the supported analysis scope.

**Developer implication:** Resolve the identified problem before treating the upgrade as mergeable. Do not treat Risky as stronger than the evidence supports.

## Indeterminate (Cannot determine)

**Meaning:** MergeSignal could not establish sufficient evidence to classify the upgrade as **Safe**, but it also did **not** establish a **concrete repository-relevant concern** that justifies asking you to review something specific.

### What Indeterminate is not

- **Indeterminate is not a risk finding.**
- **Indeterminate is not a recommendation to review the dependency.**
- **Indeterminate does not mean Safe.**
- It is **not** a warning, suspicion, partial unsafety, medium risk, or “unknown risk score.”
- There is **no numeric PR Risk severity** for indeterminate results.

### What Indeterminate is

MergeSignal is **deliberately abstaining** because the available evidence does not justify a stronger conclusion. MergeSignal prefers honest abstention over:

- false clearance;
- speculative risk;
- generic review requests;
- fabricated severity.

**Developer implication:** MergeSignal is **not** assigning dependency-specific review homework. Your normal engineering policy may still apply, but MergeSignal itself has not identified a concrete issue requiring investigation.

## Philosophy

### What earns developer attention?

**Concrete, evidence-backed repository relevance** — a specific change or condition tied to how this repository uses the dependency, with a verifiable check when review is warranted.

### What does not?

By themselves, these do **not** create MergeSignal review work:

- missing or incomplete evidence;
- unsupported or inconclusive proof execution;
- inability to prove safety.

Useful distinctions:

> **Cannot prove safe ≠ found a risk.**

> **MergeSignal raises developer work only when it has something specific and meaningful to verify.**

## Where decisions appear

- **GitHub Actions** job summaries (composite action)
- **GitHub App** Check Runs on pull requests
- **Web dashboard** scan cards and detail views
- **API** scan and PR scan endpoints
- **CLI** scan output

All surfaces derive posture from the same scan result; they do not invent independent merge decisions.

## Related documentation

- [GitHub Actions integration](../.github/actions/merge-signal-scan/README.md)
- [Architecture overview](./architecture.md)
- [@mergesignal/shared](../packages/shared/README.md) — wire types and validation (maintainers)
