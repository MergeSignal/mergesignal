"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./MSAnchorSideNav.module.css";

export type MSAnchorSideNavItem = {
  href: string;
  label: string;
};

export type MSAnchorSideNavProps = {
  items: readonly MSAnchorSideNavItem[] | MSAnchorSideNavItem[];
  /** Accessible name for the nav landmark (no visible title). */
  ariaLabel?: string;
  className?: string;
};

function sectionIds(items: MSAnchorSideNavProps["items"]): string[] {
  return items.map((item) =>
    item.href.startsWith("#") ? item.href.slice(1) : item.href,
  );
}

/**
 * Sticky in-page anchor links with scroll-spy highlighting. Pass `items` from the parent route.
 * Requires matching `id` attributes on sections (e.g. `href="#foo"` → `id="foo"`).
 */
export function MSAnchorSideNav({
  items,
  ariaLabel = "Page sections",
  className,
}: MSAnchorSideNavProps) {
  const ids = useMemo(() => sectionIds(items), [items]);
  const [activeId, setActiveId] = useState<string>(() => ids[0] ?? "");

  const updateActive = useCallback(() => {
    const header = document.querySelector("header");
    const headerH = header?.getBoundingClientRect().height ?? 60;
    /* Scroll-spy offset below header; ~var(--ms-space-sm) visually */
    const marker = headerH + 12;
    let current = ids[0] ?? "";
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const { top } = el.getBoundingClientRect();
      if (top <= marker) {
        current = id;
      }
    }
    setActiveId((prev) => (prev === current ? prev : current));
  }, [ids]);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (raw && ids.includes(raw)) {
      setActiveId(raw);
    }
    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [updateActive, ids]);

  useEffect(() => {
    const onHash = () => {
      const raw = window.location.hash.replace(/^#/, "");
      if (raw && ids.includes(raw)) {
        setActiveId(raw);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [ids]);

  const navClass = [styles.nav, className].filter(Boolean).join(" ");

  return (
    <nav className={navClass} aria-label={ariaLabel}>
      <ul className={styles.list}>
        {items.map((item) => {
          const id = item.href.startsWith("#") ? item.href.slice(1) : item.href;
          const isActive = activeId === id;
          return (
            <li key={item.href}>
              <a
                href={item.href}
                className={[styles.link, isActive ? styles.linkActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "location" : undefined}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
