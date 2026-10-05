"use client";

import { useEffect } from "react";

/**
 * Calls `tick` every `intervalMs` while `enabled`, waiting for each tick to
 * finish before scheduling the next. Hidden tabs (background tab, locked
 * phone) skip ticks; becoming visible again ticks immediately. `tick` should be
 * stable (useCallback/useMemo) or the loop restarts on every render. It gets an
 * `isCurrent` check so async work can drop results after the loop stops.
 */
export function usePollWhileVisible(
  tick: (isCurrent: () => boolean) => void | Promise<void>,
  intervalMs: number,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timeoutId = 0;
    let running = false;
    let paused = false;
    const isCurrent = () => !cancelled;

    const run = async () => {
      timeoutId = 0;
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        paused = true;
        return;
      }
      running = true;
      try {
        await tick(isCurrent);
      } catch {
        /* Network blip. Try again on the next tick. */
      } finally {
        running = false;
      }
      if (!cancelled) timeoutId = window.setTimeout(run, intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible" || !paused || running) return;
      paused = false;
      void run();
    };

    timeoutId = window.setTimeout(run, intervalMs);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tick, intervalMs, enabled]);
}
