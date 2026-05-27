import { describe, expect, it } from "vitest";
import {
  homepageSectionRowBodies,
  primaryPrExample,
  productMessaging,
} from "./productMessaging.js";

const LOCKED_H1 = "See what a dependency upgrade can break.";

const FORBIDDEN_MARKETING_TERMS = [
  "runtime-aware",
  "AI-powered",
  "framework-aware",
  "observability",
  "exhaustive indexing",
  "repo analytics",
  "risk platform",
  "risk intelligence platform",
  "security analysis platform",
  "scanner platform",
] as const;

describe("productMessaging", () => {
  it("locks hero H1 exactly including trailing period", () => {
    expect(productMessaging.hero.h1).toBe(LOCKED_H1);
    expect(productMessaging.hero.h1.endsWith(".")).toBe(true);
  });

  it("keeps lead separate from H1", () => {
    expect(productMessaging.hero.lead).not.toBe(productMessaging.hero.h1);
  });

  it("uses express middleware example for marketing card", () => {
    expect(primaryPrExample.package).toBe("express");
    expect(primaryPrExample.message).toContain("middleware ordering");
    expect(primaryPrExample.where).toHaveLength(2);
  });

  it("uses engineering-native example domains", () => {
    const text = [primaryPrExample.message, ...primaryPrExample.where].join(
      " ",
    );
    expect(text.toLowerCase()).toMatch(/auth|middleware|routes/);
  });

  it("keeps section row bodies under 20 words", () => {
    for (const body of homepageSectionRowBodies()) {
      const wordCount = body.trim().split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(20);
    }
  });

  it("avoids em dashes in marketing copy", () => {
    const strings = collectMarketingStrings();
    for (const s of strings) {
      expect(s).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("avoids forbidden marketing terms in hero and seo", () => {
    const heroSeo = [
      productMessaging.hero.kicker,
      productMessaging.hero.h1,
      productMessaging.hero.lead,
      productMessaging.seo.title,
      productMessaging.seo.description,
      productMessaging.formalDefinition,
    ].join(" ");
    for (const term of FORBIDDEN_MARKETING_TERMS) {
      expect(heroSeo.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("does not expose comparison hooks in hero exports", () => {
    expect(productMessaging.hero.kicker).not.toContain("Dependabot");
    expect(productMessaging.hero.h1).not.toContain("Dependabot");
    expect(productMessaging.hero.lead).not.toContain("Dependabot");
  });

  it("describes dashboard posture and exposure without scoring jargon", () => {
    const d = productMessaging.dashboardPrCard;
    const text = [
      d.intro,
      d.posture,
      d.exposure,
      d.exposureCategoriesLead,
      ...d.exposureCategories,
      d.cardBody,
    ].join(" ");
    expect(text).toContain("merge recommendation");
    expect(text).toContain("runtime-relevant");
    expect(text).not.toMatch(/risk index|total score|0-100|formula|weight/i);
    expect(d.exposureCategories).toHaveLength(5);
    expect(d.exposureCategories).toContain("Elevated exposure");
  });
});

function collectMarketingStrings(): string[] {
  const out: string[] = [
    productMessaging.formalDefinition,
    productMessaging.hero.kicker,
    productMessaging.hero.h1,
    productMessaging.hero.lead,
    productMessaging.seo.title,
    productMessaging.seo.description,
    primaryPrExample.message,
    ...primaryPrExample.where,
  ];
  for (const body of homepageSectionRowBodies()) {
    out.push(body);
  }
  const d = productMessaging.dashboardPrCard;
  out.push(
    d.intro,
    d.posture,
    d.exposure,
    d.exposureCategoriesLead,
    d.cardBody,
    ...d.exposureCategories,
  );
  return out;
}
