"use client";

import { useActionState, useState } from "react";
import { updateFinalCompetitionOffer } from "@/app/actions/comp";

export function HostOfferAction({ applicationId, teamName, intent }: { applicationId: string; teamName: string; intent: "promote" | "reoffer" }) {
  const [state, action, pending] = useActionState(updateFinalCompetitionOffer, undefined);
  const [confirming, setConfirming] = useState(false);
  return <div className="space-y-2">
    {!confirming ? <button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(true)}>{intent === "promote" ? "Offer spot" : "Offer again"}</button> :
      <form action={action} className="rounded-lg border border-warning-line bg-warning-soft p-3 text-sm">
        <p className="mb-2">Offer a spot to {teamName}? The team must confirm before it counts as committed.</p>
        <input type="hidden" name="applicationId" value={applicationId} />
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="acknowledge" value="on" />
        <div className="flex flex-wrap gap-2"><button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(false)}>Cancel</button><button className="btn btn-primary py-1.5" disabled={pending} type="submit">{pending ? "Sending…" : "Yes, offer spot"}</button></div>
      </form>}
    {state?.error ? <p className="text-xs text-danger" role="alert">{state.error}</p> : null}
    {state?.ok ? <p className="text-xs text-success" role="status">{state.message}</p> : null}
  </div>;
}
