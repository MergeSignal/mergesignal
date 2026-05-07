import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  BugOff,
  ChevronDown,
  ClipboardCheck,
  Crosshair,
  Gauge,
  MapPinned,
  MessagesSquare,
  Microscope,
  Route,
  ScrollText,
  Telescope,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { ScrollButton } from "../components/shared/ScrollButton/ScrollButton";
import styles from "./landing.module.css";

function SectionRow({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className={styles.sectionListItem}>
      <span className={styles.rowIcon}>
        <Icon size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <div className={styles.rowBody}>
        <span className={styles.itemLabel}>{title}</span>
        {children}
      </div>
    </li>
  );
}

export default async function Home() {
  const session = await auth();
  if (session) redirect("/app");
  return (
    <>
      <section className={styles.hero} aria-labelledby="hero-heading">
        <div className={styles.heroInner}>
          <p className={styles.kicker}>Know the risk before you merge</p>
          <h1 id="hero-heading">See what a dependency upgrade can break</h1>
          <p className={styles.heroLead}>
            MergeSignal analyzes your dependency changes and shows where real
            runtime issues are likely to occur, so your team knows exactly what
            to verify before merging.
          </p>
          <div className={styles.heroActions}>
            <Link href="/getting-started" className={styles.primaryCta}>
              Get started for free
            </Link>
            <ScrollButton targetId="why-hard" className={styles.ghostCta}>
              Learn more <ChevronDown size={16} strokeWidth={2} aria-hidden />
            </ScrollButton>
          </div>
        </div>
      </section>

      <div className={styles.sectionStack}>
        <section
          id="why-hard"
          className={styles.sectionCard}
          aria-labelledby="pain-heading"
          style={{
            scrollMarginTop: "calc(var(--ms-site-header-height) + 1.5rem)",
          }}
        >
          <div className={styles.sectionHead}>
            <h2 id="pain-heading" className={styles.h2}>
              Why dependency upgrades are hard to review
            </h2>
            <p className={styles.subhead}>
              Upgrading is easy. Knowing what it actually affects is not.
            </p>
          </div>
          <ul className={styles.sectionList}>
            <SectionRow
              icon={ScrollText}
              title="Changelogs don’t show real impact"
            >
              They list changes, but not how those changes affect your code
              paths, flows, and edge cases.
            </SectionRow>
            <SectionRow
              icon={BellRing}
              title="Too much signal, not enough clarity"
            >
              Security tools and alerts create noise, but rarely show what
              actually matters for this specific PR.
            </SectionRow>
            <SectionRow
              icon={Route}
              title="Runtime impact is hard to reason about"
            >
              Understanding how a change flows through auth, middleware, and
              critical paths requires context most reviews do not have.
            </SectionRow>
          </ul>
        </section>

        <section className={styles.sectionCard} aria-labelledby="focus-heading">
          <div className={styles.sectionHead}>
            <h2 id="focus-heading" className={styles.h2}>
              What MergeSignal focuses on
            </h2>
            <p className={styles.subhead}>
              Less noise. Clear answers about what actually matters.
            </p>
          </div>
          <ul className={styles.sectionList}>
            <SectionRow icon={Crosshair} title="What can break">
              Highlights likely failure modes based on how your code uses the
              updated dependencies.
            </SectionRow>
            <SectionRow icon={MapPinned} title="Where it can break">
              Points to the exact parts of your app affected, including auth
              flows, middleware, and critical paths.
            </SectionRow>
            <SectionRow
              icon={ClipboardCheck}
              title="What to verify before merging"
            >
              Provides concrete checks so your team knows exactly what needs to
              be validated for this upgrade.
            </SectionRow>
          </ul>
        </section>

        {/* <section className={styles.sectionCard} aria-labelledby="how-heading">
          <div className={styles.sectionHead}>
            <h2 id="focus-heading" className={styles.h2}>
              How it works
            </h2>
            <p className={styles.subhead}>
              From dependency changes to clear, actionable insight.
            </p>
          </div>
          <ul className={styles.sectionList}>
            <SectionRow icon={Crosshair} title="Scan dependency changes">
              Detects version updates and maps how updated packages are actually
              used across your codebase.
            </SectionRow>
            <SectionRow icon={MapPinned} title="Focus on real impact">
              Prioritizes changes that are most likely to affect runtime
              behavior, not a full list of every possible issue.
            </SectionRow>
            <SectionRow icon={ClipboardCheck} title="Trace critical paths">
              Analyzes how changes propagate through auth, middleware, and other
              user-facing flows.
            </SectionRow>
            <SectionRow icon={ClipboardCheck} title="Deliver clear next steps">
              Provides concise guidance on what could break, why it matters, and
              what to verify before merging.
            </SectionRow>
          </ul>
        </section> */}

        {/* <section
          className={styles.sectionCard}
          aria-labelledby="features-heading"
        >
          <div className={styles.sectionHead}>
            <h2 id="features-heading" className={styles.h2}>
              What you get in every PR
            </h2>
            <p className={styles.subhead}>
              Clear, focused insight into what actually matters.
            </p>
          </div>
          <ul className={styles.sectionList}>
            <SectionRow icon={GitBranch} title="Usage-aware analysis">
              Connects dependency changes to the parts of your code that
              actually use them.
            </SectionRow>
            <SectionRow icon={ListFilter} title="Prioritized insight">
              Surfaces a small set of high-impact items so reviews start in the
              right place.
            </SectionRow>
            <SectionRow icon={Activity} title="Real runtime context">
              Shows where issues are likely to appear, across auth, middleware,
              and critical flows.
            </SectionRow>
            <SectionRow icon={Layers} title="Actionable next steps">
              Actionable next steps
            </SectionRow>
          </ul>
        </section> */}

        <section className={styles.sectionCard} aria-labelledby="value-heading">
          <div className={styles.sectionHead}>
            <h2 id="value-heading" className={styles.h2}>
              What changes when you use MergeSignal
            </h2>
            <p className={styles.subhead}>
              Faster decisions, fewer surprises, and more confident merges.
            </p>
          </div>
          <ul className={styles.sectionList}>
            <SectionRow icon={Gauge} title="Reviews move faster">
              Focus on the right risks instead of reconstructing impact from
              changelogs and scattered context.
            </SectionRow>
            <SectionRow icon={Microscope} title="Testing becomes targeted">
              Effort goes to the flows that matter, not spread across the entire
              system.
            </SectionRow>
            <SectionRow icon={BugOff} title="Fewer production surprises">
              Issues are caught while changes are still small and easy to fix.
            </SectionRow>
            <SectionRow icon={UsersRound} title="Teams stay aligned">
              Everyone works from the same understanding of risk before merging.
            </SectionRow>
          </ul>
        </section>

        <section
          className={`${styles.sectionCard} ${styles.sectionCardAccent}`}
          aria-labelledby="position-heading"
        >
          <div className={styles.sectionHead}>
            <h2 id="position-heading" className={styles.h2}>
              Built for clarity
            </h2>
            <p className={styles.subhead}>
              MergeSignal focuses on what can actually affect your application,
              and turns it into insight your team can act on.
            </p>
          </div>
          <ul className={styles.sectionList}>
            <SectionRow icon={Telescope} title="Depth where it matters">
              Surfaces a small set of high-impact risks based on how your code
              uses updated dependencies.
            </SectionRow>
            <SectionRow
              icon={MessagesSquare}
              title="Clear, actionable language"
            >
              Explains impact in plain terms your team can use directly in
              reviews and decisions.
            </SectionRow>
          </ul>
        </section>
      </div>

      <section className={styles.finalCta} aria-labelledby="final-heading">
        <h2 id="final-heading" className={styles.finalTag}>
          Try it on your next upgrade PR
        </h2>
        <p className={styles.finalLead}>
          Connect GitHub when you&apos;re ready to scan a repo; until then, this
          page is here to explain how MergeSignal thinks about dependency risk.
        </p>
        <Link href="/getting-started" className={styles.primaryCta}>
          Get started for free
        </Link>
      </section>
    </>
  );
}
