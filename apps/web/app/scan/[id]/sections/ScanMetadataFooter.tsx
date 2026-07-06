import type { ScanDetailsPresentation } from "@mergesignal/shared";
import { formatRelativeTime } from "../../../../lib/formatRelativeTime";
import styles from "../ScanDetail.module.css";

type Props = {
  metadata: ScanDetailsPresentation["metadata"];
};

export function ScanMetadataFooter({ metadata }: Props) {
  const parts: string[] = [];
  if (metadata.generatedAt) {
    parts.push(`Scanned ${formatRelativeTime(metadata.generatedAt)}`);
  }
  if (metadata.changedPackagesSummary) {
    parts.push(metadata.changedPackagesSummary);
  }

  return (
    <footer className={styles.metadataFooter}>
      <p className={styles.metadataLine}>{parts.join(" · ")}</p>
      <details className={styles.metadataDetails}>
        <summary>Scan details</summary>
        <dl className={styles.metadataDl}>
          <dt>Scan ID</dt>
          <dd>
            <code>{metadata.scanId}</code>
          </dd>
          {metadata.methodologyVersion ? (
            <>
              <dt>Methodology</dt>
              <dd>{metadata.methodologyVersion}</dd>
            </>
          ) : null}
        </dl>
      </details>
    </footer>
  );
}
