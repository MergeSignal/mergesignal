/**
 * Dashboard PR card lifecycle — distinct from pipeline status.
 *
 * Pipeline / infrastructure: `scanning`, `analysis_failed`, `surfaces_incomplete`
 * Product / assessment: `ready`, `stale`
 * Absence: `not_scanned`
 */
export type ScanCardPresentationState =
  | "not_scanned"
  | "scanning"
  | "analysis_failed"
  | "surfaces_incomplete"
  | "ready"
  | "stale";

const STALE_SUBLINE = "Based on earlier commit";

export function staleScanSubline(): string {
  return STALE_SUBLINE;
}
