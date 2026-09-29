"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({
  active,
  intervalMs = 5000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timeoutId = 0;

    const tick = () => {
      if (cancelled) return;
      router.refresh();
      timeoutId = window.setTimeout(tick, intervalMs);
    };

    timeoutId = window.setTimeout(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active, intervalMs, router]);

  return null;
}
