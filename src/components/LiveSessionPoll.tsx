"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveSessionPoll({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timeoutId = 0;

    const tick = () => {
      if (cancelled) return;
      router.refresh();
      timeoutId = window.setTimeout(tick, 5000);
    };

    timeoutId = window.setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active, router]);

  return null;
}
