import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  ClipboardCheck,
  Cpu,
  GitPullRequest,
  Package,
  Route,
  ScrollText,
  ShieldAlert,
  Signal,
  Target,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { productMessaging } from "@mergesignal/shared";
import { auth } from "../../auth";
import { ScrollButton } from "../components/shared/ScrollButton/ScrollButton";
import styles from "./landing.module.css";

const { hero, homepageSections, finalCta } = productMessaging;

/** One icon per homepage row — matched to row copy, no reuse across the page. */
const PAIN_ICONS: LucideIcon[] = [ScrollText, ShieldAlert, Cpu];
const FOCUS_ICONS: LucideIcon[] = [Package, Route, ClipboardCheck];
const VALUE_ICONS: LucideIcon[] = [Zap, Target, GitPullRequest, Signal];

function SectionRow({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <li className={styles.sectionListItem}>
      <span className={styles.rowIcon}>
        <Icon size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <div className={styles.rowBody}>
        <span className={styles.itemLabel}>{title}</span>
        <p className={styles.rowText}>{body}</p>
      </div>
    </li>
  );
}

function SectionCard({
  id,
  section,
  icons,
  accent,
}: {
  id?: string;
  section: {
    title: string;
    subhead: string;
    rows: ReadonlyArray<{ title: string; body: string }>;
  };
  icons: LucideIcon[];
  accent?: boolean;
}) {
  return (
    <section
      id={id}
      className={`${styles.sectionCard}${accent ? ` ${styles.sectionCardAccent}` : ""}`}
      aria-labelledby={id ? `${id}-heading` : undefined}
    >
      <div className={styles.sectionHead}>
        <h2 id={id ? `${id}-heading` : undefined} className={styles.h2}>
          {section.title}
        </h2>
        <p className={styles.subhead}>{section.subhead}</p>
      </div>
      <ul className={styles.sectionList}>
        {section.rows.map((row, index) => (
          <SectionRow
            key={row.title}
            icon={icons[index]!}
            title={row.title}
            body={row.body}
          />
        ))}
      </ul>
    </section>
  );
}

export default async function Home() {
  const session = await auth();
  if (session) redirect("/app");
  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-heading">
        <div className={styles.heroInner}>
          <p className={styles.kicker}>{hero.kicker}</p>
          <h1 id="hero-heading">{hero.h1}</h1>
          <p className={styles.heroLead}>{hero.lead}</p>
          <div className={styles.heroActions}>
            <Link href="/getting-started" className={styles.primaryCta}>
              {finalCta.button}
            </Link>
            <ScrollButton targetId="why-hard" className={styles.ghostCta}>
              Learn more <ChevronDown size={16} strokeWidth={2} aria-hidden />
            </ScrollButton>
          </div>
        </div>
      </section>

      <div className={styles.sectionStack}>
        <SectionCard
          id="why-hard"
          section={homepageSections.pain}
          icons={PAIN_ICONS}
        />
        <SectionCard section={homepageSections.focus} icons={FOCUS_ICONS} />
        <SectionCard section={homepageSections.value} icons={VALUE_ICONS} />
      </div>

      <section className={styles.finalCta} aria-labelledby="final-heading">
        <h2 id="final-heading" className={styles.finalTag}>
          {finalCta.headline}
        </h2>
        <p className={styles.finalLead}>{finalCta.lead}</p>
        <Link href="/getting-started" className={styles.primaryCta}>
          {finalCta.button}
        </Link>
      </section>
    </>
  );
}
