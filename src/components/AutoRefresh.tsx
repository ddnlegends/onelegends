"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePollWhileVisible } from "@/components/usePollWhileVisible";

/**
 * Re-renders the current page on the server every `intervalMs` while `active`.
 * Pauses while the tab is hidden and refreshes as soon as it is visible again.
 */
export function AutoRefresh({
  active,
  intervalMs = 5000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  usePollWhileVisible(refresh, intervalMs, active);
  return null;
}
