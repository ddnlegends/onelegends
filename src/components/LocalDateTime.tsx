"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Render a saved instant in the viewer's time zone without a hydration mismatch. */
export function LocalDateTime({ date }: { date: Date | string }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const iso = new Date(date).toISOString();

  return (
    <time dateTime={iso}>
      {hydrated
        ? new Date(iso).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "longGeneric",
          })
        : "Loading local time…"}
    </time>
  );
}
