"use client";

import { useActionState } from "react";
import {
  advanceLiveViewing,
  rewindLiveViewing,
  startLiveViewing,
} from "@/app/actions/live-viewing";
import { SaveNotice } from "@/components/SaveNotice";

export function StartLiveViewingForm() {
  const [state, formAction, pending] = useActionState(startLiveViewing, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <SaveNotice state={state} fallbackOk="Team 1 is up." refresh={false} />
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Starting…" : "Start viewing · Team 1"}
      </button>
    </form>
  );
}

export function LiveViewingNav({
  position,
  total,
  canAdvance,
}: {
  position: number;
  total: number;
  canAdvance: boolean;
}) {
  const [nextState, nextAction, nextPending] = useActionState(
    advanceLiveViewing,
    undefined,
  );
  const [prevState, prevAction, prevPending] = useActionState(
    rewindLiveViewing,
    undefined,
  );
  const last = position >= total;

  return (
    <div className="space-y-3">
      <SaveNotice state={nextState} refresh={false} />
      <SaveNotice state={prevState} refresh={false} />
      <div className="flex flex-wrap gap-2">
        {position > 1 ? (
          <form action={prevAction}>
            <button className="btn btn-ghost" disabled={prevPending} type="submit">
              {prevPending ? "…" : `Back to Team ${position - 1}`}
            </button>
          </form>
        ) : null}
        {last ? (
          <p className="text-sm text-muted">
            Last team. Judges save this scoresheet, then Submit Judging.
          </p>
        ) : (
          <form action={nextAction}>
            <button
              className="btn btn-primary"
              disabled={nextPending || !canAdvance}
              type="submit"
            >
              {nextPending ? "…" : `Next · Team ${position + 1}`}
            </button>
          </form>
        )}
      </div>
      {!last && !canAdvance ? (
        <p className="text-sm text-muted">
          Next unlocks after every judge still in the session saves this team.
        </p>
      ) : null}
    </div>
  );
}
