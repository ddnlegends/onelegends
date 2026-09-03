"use client";

import { useActionState } from "react";
import Link from "next/link";
import { applyToCompetitions } from "@/app/actions/team";

type Comp = {
  id: string;
  name: string;
  dates: string;
  location: string;
  venue: string;
  acceptingApps: boolean;
  alreadyApplied: boolean;
};

export function ApplyForm({ competitions }: { competitions: Comp[] }) {
  const [state, formAction, pending] = useActionState(
    applyToCompetitions,
    undefined,
  );
  const open = competitions.filter((c) => c.acceptingApps);
  const closed = competitions.filter((c) => !c.acceptingApps);

  return (
    <form action={formAction} className="space-y-6">
      <p className="text-sm text-muted">
        One application, many comps. Check the ones you want — your complete
        team profile, AV Drive link, roster, dietary notes, and shirt sizes go
        with it. Payment is handled off this site.
      </p>

      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {open.map((comp) => (
          <li key={comp.id} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              name="competitionId"
              value={comp.id}
              id={`comp-${comp.id}`}
              defaultChecked={comp.alreadyApplied}
              disabled={comp.alreadyApplied}
              className="mt-1"
            />
            <label htmlFor={`comp-${comp.id}`} className="flex-1 cursor-pointer">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{comp.name}</span>
                <Link
                  href={`/comps/${comp.id}`}
                  className="text-xs text-muted underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Details
                </Link>
              </div>
              <p className="text-sm text-muted">
                {[comp.dates, comp.location, comp.venue].filter(Boolean).join(" · ") ||
                  "Details TBA"}
              </p>
              {comp.alreadyApplied ? (
                <p className="mt-1 text-xs font-medium text-accent">Already applied</p>
              ) : null}
            </label>
          </li>
        ))}
      </ul>

      {closed.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Not accepting apps
          </h3>
          <ul className="text-sm text-muted">
            {closed.map((comp) => (
              <li key={comp.id}>
                {comp.name}
                {comp.dates ? ` — ${comp.dates}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">{state.message}</p> : null}

      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Sending…" : "Apply to selected comps"}
      </button>
    </form>
  );
}
