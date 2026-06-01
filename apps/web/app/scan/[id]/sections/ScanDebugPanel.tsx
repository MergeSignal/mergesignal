"use client";

import { MSCard } from "../../../components/shared/MSCard/MSCard";
import styles from "../ScanDetail.module.css";

type Props = {
  data: unknown;
};

export function ScanDebugPanel({ data }: Props) {
  return (
    <MSCard title="Maintainer debug" className={styles.debugPanel}>
      <pre className={styles.debugPre}>{JSON.stringify(data, null, 2)}</pre>
    </MSCard>
  );
}
