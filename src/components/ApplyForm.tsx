"use client";

import { useActionState } from "react";
import Link from "next/link";
import { applyToCompetitions } from "@/app/actions/team";
import { CompetitionTypeBadge } from "@/components/CompetitionTypeBadge";
import { formatApplicationFee } from "@/lib/competition-details";

type Comp = {
  id: string;
  name: string;
  isPartner: boolean;
  dates: string;
  location: string;
  venue: string;
  regularApplicationFeeCents: number | null;
  lateApplicationFeeCents: number | null;
  earlyDeadline?: string;
  lateDeadline?: string;
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
  const types = [
    { isPartner: true, label: "Partner Competitions" },
    { isPartner: false, label: "Non-partner Competitions" },
  ];

  return (
    <form action={formAction} className="space-y-6">
      <p className="text-sm text-muted">
        One application, many comps. Check the ones you want — your complete
        team profile, AV Drive link, roster, dietary notes, and shirt sizes go
        with it.{" "}
        Pay via Zelle or PayPal to{" "}
        <a href="mailto:legends@desidancenetwork.org" className="text-accent underline">
          legends@desidancenetwork.org
        </a>
        . See the{" "}
        <Link href="/payments" className="text-accent underline">
          payment instructions
        </Link>{" "}
        before sending money. Review each competition’s details for its separate application fees, payment instructions, and application packet.
      </p>

      {open.length === 0 ? (
        <p className="text-sm text-muted">
          No competitions are accepting applications right now.
        </p>
      ) : (
        types.map(({ isPartner, label }) => {
          const group = open.filter((comp) => comp.isPartner === isPartner);
          if (!group.length) return null;
          return (
            <section key={label} className="space-y-2" aria-label={label}>
              <h2 className="font-heading text-xl">{label}</h2>
              <ul className="divide-y divide-line rounded-xl border border-line bg-card">
                {group.map((comp) => (
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
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{comp.name}</span>
                          <CompetitionTypeBadge isPartner={comp.isPartner} />
                        </span>
                        <Link
                          href={`/comps/${comp.id}`}
                          className="text-xs text-muted underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Details &amp; payment
                        </Link>
                      </div>
                      <p className="text-sm text-muted">
                        {[comp.dates, comp.location, comp.venue].filter(Boolean).join(" · ") || "Details TBA"}
                        {comp.earlyDeadline ? ` · Regular deadline ${comp.earlyDeadline}` : ""}
                        {comp.lateDeadline ? ` · Late deadline ${comp.lateDeadline}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-muted">Host application fees: regular {formatApplicationFee(comp.regularApplicationFeeCents)} · late {formatApplicationFee(comp.lateApplicationFeeCents)} (USD per team)</p>
                      {comp.alreadyApplied ? (
                        <p className="mt-1 text-xs font-medium text-accent">Already applied</p>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {closed.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Not accepting apps
          </h3>
          {types.map(({ isPartner, label }) => {
            const group = closed.filter((comp) => comp.isPartner === isPartner);
            if (!group.length) return null;
            return (
              <section key={label} className="mt-3 space-y-1" aria-label={`${label} not accepting applications`}>
                <h4 className="font-medium">{label}</h4>
                <ul className="text-sm text-muted">
                  {group.map((comp) => (
                    <li key={comp.id}>
                      {comp.name} <CompetitionTypeBadge isPartner={comp.isPartner} />
                      {comp.dates ? ` — ${comp.dates}` : ""}
                      {comp.earlyDeadline ? ` · Regular deadline ${comp.earlyDeadline}` : ""}
                      {comp.lateDeadline ? ` · Late deadline ${comp.lateDeadline}` : ""}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">{state.message}</p> : null}

      {open.length > 0 ? (
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Sending…" : "Apply to selected comps"}
        </button>
      ) : null}
    </form>
  );
}
