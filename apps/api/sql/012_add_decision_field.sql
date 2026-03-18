-- Migration: Add decision field to scans table
-- Purpose: Persist the decision recommendation (safe/needs_review/risky) for analytics and filtering
-- Author: System
-- Date: 2026-03-18

-- Add decision column with CHECK constraint
ALTER TABLE scans 
ADD COLUMN decision TEXT CHECK (decision IN ('safe', 'needs_review', 'risky'));

-- Add index for efficient querying by decision type
CREATE INDEX scans_decision_idx ON scans(decision);

-- Add composite index for common query patterns (decision + created_at for time-based filtering)
CREATE INDEX scans_decision_created_at_idx ON scans(decision, created_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN scans.decision IS 'AI-generated decision recommendation: safe (0-30 score), needs_review (31-60 score), risky (61-100 score). Populated by worker after analysis.';
