import styles from "./MSTable.module.css";

export type MSDataTableProps = {
  headers: string[];
  minWidth?: number;
  rows: React.ReactNode;
  className?: string;
};

export function MSDataTable({
  headers,
  minWidth,
  rows,
  className,
}: MSDataTableProps) {
  const rootClass = [styles.card, className].filter(Boolean).join(" ");
  return (
    <div className={rootClass}>
      <div className={styles.wrap}>
        <table
          className={styles.table}
          style={minWidth ? { minWidth } : undefined}
        >
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

export function MSTD({ children }: { children: React.ReactNode }) {
  return <td className={styles.td}>{children}</td>;
}
