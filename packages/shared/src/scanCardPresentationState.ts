/** Dashboard PR card lifecycle — distinct from pipeline status. */
export type ScanCardPresentationState =
  | "not_scanned"
  | "scanning"
  | "analysis_failed"
  | "ready"
  | "stale";

const STALE_SUBLINE = "Based on earlier commit";

export function staleScanSubline(): string {
  return STALE_SUBLINE;
}
