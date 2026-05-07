import styles from "./MSCard.module.css";

export type MSCardProps = {
  title?: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  padding?: boolean;
  as?: "section" | "div";
  className?: string;
};

export function MSCard({
  title,
  subtitle,
  children,
  padding = true,
  as = "section",
  className,
}: MSCardProps) {
  const Tag = as;
  const rootClass = [styles.card, padding ? "" : styles.noPadding, className]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={rootClass}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      {subtitle ? <p className={styles.muted}>{subtitle}</p> : null}
      {children}
    </Tag>
  );
}

export type MSCardMutedProps = {
  as?: "p" | "span" | "div";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/** Muted helper text inside an MSCard (or adjacent card content). */
export function MSCardMuted({
  as: Tag = "p",
  children,
  className,
  style,
}: MSCardMutedProps) {
  return (
    <Tag
      className={[styles.muted, className].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </Tag>
  );
}

export type MSCardNoteProps = {
  as?: "div" | "span" | "p";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/** Note / secondary block inside card content; supports `code` descendants. */
export function MSCardNote({
  as: Tag = "div",
  children,
  className,
  style,
}: MSCardNoteProps) {
  return (
    <Tag
      className={[styles.note, className].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </Tag>
  );
}
