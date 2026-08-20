-- Migration: Extend scans.decision CHECK to accept indeterminate
-- Purpose: Persist the fourth canonical Assessment outcome recommendation
-- Author: System
-- Date: 2026-08-20

-- Forward-only extension: existing safe/needs_review/risky values remain valid.
-- Historical rows are not rewritten; abstention semantics on legacy rows are
-- interpreted by outcome-aware readers without mutating stored evidence.

ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_decision_check;

ALTER TABLE scans
  ADD CONSTRAINT scans_decision_check
  CHECK (decision IN ('safe', 'needs_review', 'risky', 'indeterminate'));

COMMENT ON COLUMN scans.decision IS 'Canonical decision recommendation emitted by Engine Output Finalization: safe, needs_review, risky, or indeterminate. Populated by worker after analysis; persistence does not infer Assessment semantics.';
