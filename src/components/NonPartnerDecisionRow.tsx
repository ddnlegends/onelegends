"use client";

import { useActionState, useState } from "react";
import type { ApplicationStatus, TeamOfferResponse } from "@prisma/client";
import { saveNonPartnerDecision } from "@/app/actions/nonpartner-decisions";
import { offerStatusLabel } from "@/lib/application-offers";
import { HostOfferAction } from "@/components/HostOfferAction";

export function NonPartnerDecisionRow({ applicationId, teamName, initialStatus, publishedAt, teamOfferResponse }: {
  applicationId: string;
  teamName: string;
  initialStatus: ApplicationStatus;
  publishedAt: Date | null;
  teamOfferResponse: TeamOfferResponse;
}) {
  const [state, action, pending] = useActionState(saveNonPartnerDecision, undefined);
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus === "WAITLISTED" && !publishedAt ? "PENDING" : initialStatus);
  const [confirmed, setConfirmed] = useState(false);
  const published = Boolean(publishedAt);
  return <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-4 last:border-0">
    <div>
      <p className="font-semibold">{teamName}</p>
      <p className="text-sm text-muted">{published
        ? offerStatusLabel({ status: initialStatus, teamOfferResponse, decisionsSubmittedAt: publishedAt })
        : initialStatus === "PENDING" ? "No decision saved" : `${initialStatus === "ACCEPTED" ? "Accepted" : initialStatus === "WAITLISTED" ? "Waitlisted" : "Declined"} draft · private`}</p>
    </div>
    {published ? <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-full border border-line bg-blush px-3 py-1 text-xs font-semibold">Published</span>
      {initialStatus === "WAITLISTED" && teamOfferResponse === "NONE" ? <HostOfferAction applicationId={applicationId} teamName={teamName} intent="promote" /> : null}
      {(initialStatus === "ACCEPTED" || initialStatus === "WAITLISTED") && teamOfferResponse === "DECLINED" ? <HostOfferAction applicationId={applicationId} teamName={teamName} intent="reoffer" /> : null}
    </div> :
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="applicationId" value={applicationId} />
        <select name="status" value={status} onChange={(event) => { setStatus(event.target.value as ApplicationStatus); setConfirmed(false); }} disabled={pending} className="rounded-md border border-line bg-card px-3 py-2 text-sm" aria-label={`Decision for ${teamName}`}>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accept</option>
          <option value="DECLINED">Decline</option>
        </select>
        <button type="submit" name="intent" value="draft" disabled={pending || status === initialStatus} className="btn btn-ghost">Save draft</button>
        {status !== "PENDING" ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="acknowledge" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Confirm final outcome for {teamName}</label> : null}
        <button type="submit" name="intent" value="publish" disabled={pending || status === "PENDING" || !confirmed} className="btn btn-primary">Publish to team</button>
        {state?.error ? <p role="alert" className="w-full text-sm text-danger">{state.error}</p> : null}
        {state?.ok ? <p role="status" className="w-full text-sm text-success">{state.message}</p> : null}
      </form>}
  </div>;
}
