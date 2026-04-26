import Link from "next/link";
import { AppShell } from "./_components/AppShell";
import { HomeClient } from "./_components/HomeClient";
import { cardStyles } from "./_components/ui/Card";
import styles from "./landing.module.css";

export default function Home() {
  const linkedOwner = process.env.MERGESIGNAL_LINKED_GITHUB_OWNER?.trim();

  return (
    <AppShell
      title="Dependency risk, made actionable"
      subtitle="Quickly find what’s risky, why it matters, and what to fix next."
      linkedOwner={linkedOwner}
    >
      <section className={styles.hero}>
        <p className={styles.lead}>
          MergeSignal scores dependency changes on pull requests and explains
          the tradeoffs so teams can merge with confidence.
        </p>
        <div className={styles.ctaRow}>
          <Link className={styles.primaryCta} href="/api/auth/signin/github">
            Sign in with GitHub
          </Link>
          {linkedOwner ? (
            <Link
              className={styles.secondaryCta}
              href={`/org/${encodeURIComponent(linkedOwner)}`}
            >
              Open org dashboard
            </Link>
          ) : null}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Install the GitHub App</h2>
        <p className={styles.p}>
          Connect your repositories so MergeSignal can react to lockfile changes
          on pushes and pull requests. Configure a webhook to your API host and
          grant read access to repository contents and pull requests.
        </p>
        <p className={styles.p}>
          See{" "}
          <Link
            className={styles.inlineLink}
            href="https://github.com/MergeSignal/mergesignal/blob/main/docs/github-app.md"
          >
            GitHub App setup (docs)
          </Link>{" "}
          for event subscriptions, permissions, and environment variables.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>How it works</h2>
        <ol className={styles.steps}>
          <li>Install the app on the org or repositories you want covered.</li>
          <li>
            MergeSignal receives PR and push events and enqueues scans when
            lockfiles change.
          </li>
          <li>
            Results appear in the API, the web dashboard, and PR comments (pnpm
            lockfiles supported for inline comments today).
          </li>
        </ol>
      </section>

      <HomeClient linkedOwner={linkedOwner} />

      <div className={cardStyles.note}>
        Tip: use <code>repoId</code> format <code>owner/repo</code> (e.g.{" "}
        <code>acme/repo-a</code>).
      </div>
    </AppShell>
  );
}
