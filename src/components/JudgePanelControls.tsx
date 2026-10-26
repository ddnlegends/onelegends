"use client";

import { useActionState, useState } from "react";
import { finalizeCompetitionResults, releaseCompetitionResults, removeJudgeAssignment } from "@/app/actions/comp-judging";

export function FinalizeResultsForm({
  competitionId,
  approved,
  submitted,
  pending,
  released,
  validated,
}: {
  competitionId: string;
  approved: number;
  submitted: number;
  pending: number;
  released: boolean;
  validated: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [state, action, saving] = useActionState(finalizeCompetitionResults, undefined);
  const [releaseState, releaseAction, releaseSaving] = useActionState(releaseCompetitionResults, undefined);
  const ready = !validated && !released && approved > 0 && submitted === approved && pending === 0;
  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-5">
      <h2 className="font-heading text-xl">Validate Comp Results</h2>
      <p className="text-sm text-muted">
        {submitted} of {approved} active judges submitted
        {pending ? ` · ${pending} pending invitation${pending === 1 ? "" : "s"} or request${pending === 1 ? "" : "s"} must be resolved` : ""}.
        {released ? " Results are released." : validated ? " Validated; results remain private until tech release." : " Validate before releasing results."}
      </p>
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">Results validated. Release them when ready.</p> : null}
      {releaseState?.error ? <p className="notice notice-error">{releaseState.error}</p> : null}
      {releaseState?.ok ? <p className="notice notice-ok">Results released.</p> : null}
      {!validated && !released && !confirming ? (
        <button className="btn btn-primary" type="button" disabled={!ready} onClick={() => setConfirming(true)}>
          Validate Comp Results
        </button>
      ) : null}
      {!validated && !released && confirming ? (
        <form action={action} className="space-y-3 rounded-lg border border-warning-line bg-warning-soft p-4">
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="confirmation" value="FINALIZE" />
          <p className="text-sm">Validate the {submitted} submitted judge packets? Results will remain hidden from competition admins and moderators until you release them.</p>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={saving} type="submit">{saving ? "Validating…" : "Yes, validate comp results"}</button>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </form>
      ) : null}
      {validated && !released && !releasing ? (
        <button className="btn btn-primary" type="button" onClick={() => setReleasing(true)}>Release Results</button>
      ) : null}
      {validated && !released && releasing ? (
        <form action={releaseAction} className="space-y-3 rounded-lg border border-warning-line bg-warning-soft p-4">
          <input type="hidden" name="competitionId" value={competitionId} />
          <input type="hidden" name="confirmation" value="RELEASE" />
          <p className="text-sm">Release named rankings to competition admins and moderators?</p>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={releaseSaving} type="submit">{releaseSaving ? "Releasing…" : "Yes, release results"}</button>
            <button className="btn btn-ghost" type="button" onClick={() => setReleasing(false)}>Cancel</button>
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
