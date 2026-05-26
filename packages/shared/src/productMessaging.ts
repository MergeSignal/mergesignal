/**
 * Canonical marketing / category copy. Operational scan strings stay in scanSurfaceCopy.
 */

export const productMessaging = {
  formalDefinition:
    "MergeSignal analyzes dependency upgrades, identifies affected application flows, and provides reviewer guidance before merge.",

  hero: {
    kicker: "Merge-decision intelligence for dependency upgrades",
    h1: "See what a dependency upgrade can break.",
    lead: "Dependency upgrade analysis that shows where runtime behavior may affect critical application flows.",
  },

  seo: {
    title: "MergeSignal - know what an upgrade may break before merge",
    description:
      "Know what a dependency upgrade may affect in your app before merge. Affected flows, reviewer checks, and merge guidance for this PR.",
  },

  finalCta: {
    headline: "Try it on your next upgrade PR",
    lead: "Run a local scan or add GitHub Actions to your workflow.",
    button: "Get started for free",
  },

  homepageSections: {
    pain: {
      title: "Why dependency upgrades are hard to review",
      subhead: "Upgrading is easy. Knowing what it affects is not.",
      rows: [
        {
          title: "Changelogs don't show real impact",
          body: "Release notes describe package changes, not how they affect your code paths and critical application flows.",
        },
        {
          title: "Too much noise, not enough clarity",
          body: "Security alerts rarely show what actually matters for this specific upgrade PR.",
        },
        {
          title: "Runtime impact is hard to reason about",
          body: "Understanding how a dependency change affects critical application flows requires deeper application context.",
        },
      ],
    },
    focus: {
      title: "What MergeSignal focuses on",
      subhead: "Clearer upgrade decisions with fewer merge surprises",
      rows: [
        {
          title: "What this upgrade affects",
          body: "Potential failure modes based on how your code uses the updated dependencies.",
        },
        {
          title: "Where it shows up",
          body: "The application flows, routes, and entrypoints affected by this upgrade.",
        },
        {
          title: "What to verify before merge",
          body: "Concrete reviewer checks for this specific upgrade.",
        },
      ],
    },
    value: {
      title: "What changes when you use MergeSignal",
      subhead: "More focused reviews and targeted validation.",
      rows: [
        {
          title: "Reviews move faster",
          body: "Start with affected flows instead of reconstructing impact from changelogs.",
        },
        {
          title: "Testing stays targeted",
          body: "Focus validation on the flows this upgrade affects.",
        },
        {
          title: "Fewer merge surprises",
          body: "Catch upgrade impact while the PR is still small.",
        },
        {
          title: "High-signal only",
          body: "MergeSignal only interrupts you when an upgrade deserves attention.",
        },
      ],
    },
  },
} as const;

/** Illustrative scan-card example for homepage proof band and getting-started. */
export const primaryPrExample = {
  package: "express",
  message: "This upgrade affects middleware ordering used in auth routes.",
  where: [
    "apps/api/src/middleware/auth.ts - auth guard depends on middleware order",
    "apps/api/src/routes/account.ts - protected handlers assume validation ran first",
  ],
} as const;

/** All homepage section row bodies for word-count validation. */
export function homepageSectionRowBodies(): string[] {
  const sections = productMessaging.homepageSections;
  return [
    ...sections.pain.rows,
    ...sections.value.rows,
    ...sections.focus.rows,
  ].map((row) => row.body);
}
