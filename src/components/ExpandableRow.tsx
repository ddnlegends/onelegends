"use client";

import { useId, useState, type ReactNode } from "react";

/** Panel content mounts only while open, so collapsed rows don't load embedded videos. */
export function ExpandableRow({
  id,
  summary,
  children,
}: {
  id?: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <article
      id={id}
      className={`rounded-2xl border bg-card transition ${
        open ? "border-accent/40 shadow-md" : "border-line hover:border-accent/30"
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <span
          aria-hidden
          className={`grid size-9 shrink-0 place-items-center rounded-full border transition ${
            open
              ? "rotate-180 border-accent bg-accent text-white"
              : "border-line text-muted"
          }`}
        >
          <svg viewBox="0 0 20 20" className="size-4 fill-current">
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
          </svg>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="space-y-6 border-t border-line px-5 py-6">
          {children}
        </div>
      ) : null}
    </article>
  );
}
