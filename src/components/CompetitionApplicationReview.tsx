"use client";

import { useActionState, useState } from "react";
import { removeCompetitionApplication } from "@/app/actions/ops-applications";
import { SaveNotice } from "@/components/SaveNotice";

type Applicant = { id: string; teamName: string; status: string };

export function CompetitionApplicationReview({
  competitionId,
  competitionName,
  applications,
  canRemove,
  removalBlockedReason,
}: {
  competitionId: string;
  competitionName: string;
  applications: Applicant[];
  canRemove: boolean;
  removalBlockedReason: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(removeCompetitionApplication, undefined);

  return (
    <section className="space-y-3 rounded-xl border border-line bg-card p-5">
      <div>
        <h2 className="font-heading text-2xl">Application payment review</h2>
        <p className="mt-1 text-sm text-muted">
          Compare applicants with payments received outside the site. Remove unpaid
          teams before opening judging so they are excluded from the viewing order.
          If applications reopen, a removed team can apply again.
        </p>
        {!canRemove && applications.length > 0 ? (
          <p className="mt-2 text-sm text-muted">{removalBlockedReason}</p>
        ) : null}
      </div>
      <SaveNotice state={state} scroll={false} />
      {applications.length === 0 ? (
        <p className="text-sm text-muted">No applications for this competition.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {applications.map((app) => (
            <li key={app.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{app.teamName}</p>
                <p className="text-xs text-muted">{app.status}</p>
              </div>
              {selectedId === app.id && canRemove ? (
                <form action={formAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="competitionId" value={competitionId} />
                  <input type="hidden" name="applicationId" value={app.id} />
                  <span className="text-sm text-muted">
                    Remove {app.teamName} from {competitionName}?
                  </span>
                  <button type="button" className="btn btn-ghost py-1 text-sm" onClick={() => setSelectedId(null)} disabled={pending}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-ghost py-1 text-sm text-danger" disabled={pending}>
                    {pending ? "Removing…" : "Confirm removal"}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost py-1 text-sm"
                  disabled={!canRemove || pending}
                  onClick={() => setSelectedId(app.id)}
                  aria-label={`Remove ${app.teamName} application`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
