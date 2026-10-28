"use client";

import { useActionState } from "react";
import Link from "next/link";
import { applyToCompetitions } from "@/app/actions/team";
import { CompetitionTypeBadge } from "@/components/CompetitionTypeBadge";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ApplicationPeriodSummary } from "@/components/ApplicationPeriodSummary";
import { COMPETITION_TYPE_GROUPS, competitionType } from "@/lib/competition-type";

type Comp = {
  id: string;
  name: string;
  isPartner: boolean;
  isAffiliate: boolean;
  dates: string;
  location: string;
  venue: string;
  earlyApplicationFeeCents: number | null;
  regularApplicationFeeCents: number | null;
  lateApplicationFeeCents: number | null;
  earlyTierDeadline?: string;
  earlyDeadline?: string;
  lateDeadline?: string;
  finalCutoff?: string;
  acceptingApps: boolean;
  alreadyApplied: boolean;
  withdrawn: boolean;
  adminRemoved: boolean;
};

function CompetitionSummary({ comp }: { comp: Comp }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {[comp.dates, comp.location, comp.venue].filter(Boolean).join(" · ") || "Event details to be announced"}
      </p>
      <ApplicationPeriodSummary schedule={{
        earlyDeadline: comp.earlyTierDeadline,
        regularDeadline: comp.earlyDeadline,
        lateDeadline: comp.lateDeadline,
        finalCutoff: comp.finalCutoff,
        earlyFeeCents: comp.earlyApplicationFeeCents,
        regularFeeCents: comp.regularApplicationFeeCents,
        lateFeeCents: comp.lateApplicationFeeCents,
      }} />
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
  const types = COMPETITION_TYPE_GROUPS;

  return (
    <form action={formAction} className="space-y-6">
      <p className="text-sm text-muted">
        One application, many comps. Check the ones you want — your complete
        team profile and roster stay current for each competition. The AV Drive
        link is saved when you apply and will not change if you edit your profile.{" "}
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
        types.map(({ type, label }) => {
          const group = open.filter((comp) => competitionType(comp) === type);
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
                          disabled={comp.alreadyApplied || comp.adminRemoved}
                          className="mt-1.5 h-4 w-4 shrink-0"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label htmlFor={`comp-${comp.id}`} className="cursor-pointer font-semibold">{comp.name}</label>
                            <CompetitionTypeBadge isPartner={comp.isPartner} isAffiliate={comp.isAffiliate} />
                          </div>
                          {comp.alreadyApplied ? <p className="mt-1 text-xs font-semibold text-accent">Already applied</p> : null}
                          {comp.withdrawn && !comp.adminRemoved ? <p className="mt-1 text-xs font-semibold text-accent">Withdrawn before · reapply at the current phase and fee</p> : null}
                          {comp.adminRemoved ? <p className="mt-1 text-xs font-semibold text-muted">Removed by tech admins · contact them for help</p> : null}
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
          {types.map(({ type, label }) => {
            const group = closed.filter((comp) => competitionType(comp) === type);
            if (!group.length) return null;
            return (
              <section key={label} className="mt-5" aria-label={`${label} not accepting applications`}>
                <h4 className="font-medium">{label}</h4>
                <ul className="mt-3 space-y-5 text-sm text-muted">
                  {group.map((comp) => (
                    <li key={comp.id} className="leading-relaxed">
                      {comp.name} <CompetitionTypeBadge isPartner={comp.isPartner} isAffiliate={comp.isAffiliate} />
                      {comp.dates ? ` — ${comp.dates}` : ""}
                      {comp.earlyTierDeadline ? <> · Early deadline <LocalDateTime date={comp.earlyTierDeadline} /></> : null}
                      {comp.earlyDeadline ? <> · Regular deadline <LocalDateTime date={comp.earlyDeadline} /></> : null}
                      {comp.lateDeadline ? <> · Late deadline <LocalDateTime date={comp.lateDeadline} /></> : null}
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
