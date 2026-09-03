"use client";

import { useActionState } from "react";
import { requestCompAccess } from "@/app/actions/judge";

type Comp = {
  id: string;
  name: string;
  dates: string;
  location: string;
};

export function JudgeRequestForm({ competitions }: { competitions: Comp[] }) {
  const [state, formAction, pending] = useActionState(
    requestCompAccess,
    undefined,
  );

  if (competitions.length === 0) {
    return (
      <p className="text-sm text-muted">
        You already have a request on file for every competition.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {competitions.map((comp) => (
          <li key={comp.id} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              name="competitionId"
              value={comp.id}
              id={`judge-comp-${comp.id}`}
              className="mt-1"
            />
            <label htmlFor={`judge-comp-${comp.id}`} className="flex-1 cursor-pointer">
              <span className="font-medium">{comp.name}</span>
              <p className="text-sm text-muted">
                {[comp.dates, comp.location].filter(Boolean).join(" · ") || "Details TBA"}
              </p>
            </label>
          </li>
        ))}
      </ul>
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">{state.message}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Sending…" : "Request Access"}
      </button>
    </form>
  );
}
