"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * While any PR scan is non-terminal, periodically re-run the server component
 * tree so pull-request-scans and GitHub PR data stay fresh (unlike the scan
 * detail page, which streams over SSE).
 */
export function RepoHealthScanPoller({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) router.refresh();
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, router]);

  return null;
}
