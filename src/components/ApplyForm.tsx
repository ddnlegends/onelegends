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

function CompetitionSummary({ comp }: { comp: Comp }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {[comp.dates, comp.location, comp.venue].filter(Boolean).join(" · ") || "Event details to be announced"}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2" aria-label={`${comp.name} application deadlines`}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Application deadlines</h4>
          <dl className="space-y-2">
            <div className="rounded-lg border border-info-line bg-info-soft px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-wide">Regular</dt>
              <dd className="mt-1 font-medium">{comp.earlyDeadline || "Not set"}</dd>
            </div>
            <div className="rounded-lg border border-warning-line bg-warning-soft px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-wide">Late · final cutoff</dt>
              <dd className="mt-1 font-medium">{comp.lateDeadline || "No automatic close"}</dd>
            </div>
          </dl>
        </section>
        <section className="space-y-2" aria-label={`${comp.name} host fees`}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Host fees · USD per team</h4>
          <dl className="space-y-2">
            <div className="rounded-lg border border-info-line bg-info-soft px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-wide">Regular</dt>
              <dd className="mt-1 font-medium">{formatApplicationFee(comp.regularApplicationFeeCents)}</dd>
            </div>
            <div className="rounded-lg border border-warning-line bg-warning-soft px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-wide">Late</dt>
              <dd className="mt-1 font-medium">{formatApplicationFee(comp.lateApplicationFeeCents)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

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
              <ul className="space-y-4">
                {group.map((comp) => (
                  <li key={comp.id} className="rounded-xl border border-line bg-card p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          name="competitionId"
                          value={comp.id}
                          id={`comp-${comp.id}`}
                          defaultChecked={comp.alreadyApplied}
                          disabled={comp.alreadyApplied}
                          className="mt-1.5 h-4 w-4 shrink-0"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label htmlFor={`comp-${comp.id}`} className="cursor-pointer font-semibold">{comp.name}</label>
                            <CompetitionTypeBadge isPartner={comp.isPartner} />
                          </div>
                          {comp.alreadyApplied ? <p className="mt-1 text-xs font-semibold text-accent">Already applied</p> : null}
                        </div>
                      </div>
                      <Link href={`/comps/${comp.id}`} className="text-sm font-medium text-accent underline">Details &amp; payment</Link>
                    </div>
                    <CompetitionSummary comp={comp} />
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
              <section key={label} className="mt-5" aria-label={`${label} not accepting applications`}>
                <h4 className="font-medium">{label}</h4>
                <ul className="mt-3 space-y-5 text-sm text-muted">
                  {group.map((comp) => (
                    <li key={comp.id} className="leading-relaxed">
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
