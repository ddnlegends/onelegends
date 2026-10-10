"use client";

import { useActionState, useState } from "react";
import { finalizeCompetitionResults, removeJudgeAssignment } from "@/app/actions/comp-judging";

export function FinalizeResultsForm({
  competitionId,
  approved,
  submitted,
  pending,
  released,
}: {
  competitionId: string;
  approved: number;
  submitted: number;
  pending: number;
  released: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, saving] = useActionState(finalizeCompetitionResults, undefined);
  const ready = !released && approved > 0 && submitted === approved && pending === 0;
  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-5">
      <h2 className="font-heading text-xl">Finalize judging results</h2>
      <p className="text-sm text-muted">
        {submitted} of {approved} active judges submitted
        {pending ? ` · ${pending} pending invitation${pending === 1 ? "" : "s"} or request${pending === 1 ? "" : "s"} must be resolved` : ""}.
        {released ? " Results are final." : " Rankings unlock only after explicit finalization."}
      </p>
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">Results finalized.</p> : null}
      {!released && !confirming ? (
        <button className="btn btn-primary" type="button" disabled={!ready} onClick={() => setConfirming(true)}>
          Finalize results
        </button>
      ) : null}
      {!released && confirming ? (
        <form action={action} className="space-y-3 rounded-lg border border-warning-line bg-warning-soft p-4">
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="confirmation" value="FINALIZE" />
          <p className="text-sm">Release named rankings using the {submitted} submitted judge packets? This closes judging and locks the panel and scores.</p>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={saving} type="submit">{saving ? "Finalizing…" : "Yes, finalize results"}</button>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function RemoveJudgeForm({
  assignmentId,
  name,
  email,
  scored,
  total,
  submitted,
  live,
}: {
  assignmentId: string;
  name: string;
  email: string;
  scored: number;
  total: number;
  submitted: boolean;
  live: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, saving] = useActionState(removeJudgeAssignment, undefined);
  if (!confirming) return (
    <div>
      <button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(true)}>Remove judge</button>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-xs text-success">{state.message}</p> : null}
    </div>
  );
  return (
    <form action={action} className="space-y-2 rounded-lg border border-warning-line bg-warning-soft p-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="confirmation" value="REMOVE" />
      <p className="text-sm">Remove <strong>{name}</strong> ({email})? {scored} of {total} teams scored{submitted ? " · packet submitted" : ""}. Their scores will be excluded.{live ? " Live viewing may pause if this is the last judge." : ""}</p>
      <label className="field text-sm">Reason
        <input name="reason" required maxLength={500} placeholder="Why is this judge leaving?" />
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary py-1.5" disabled={saving} type="submit">{saving ? "Removing…" : "Yes, remove judge"}</button>
        <button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(false)}>Cancel</button>
      </div>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
