"use client";

import { useActionState } from "react";
import { setJudgingOpen } from "@/app/actions/ops-judging";
import { SaveNotice } from "@/components/SaveNotice";
import { describePanelBlockers } from "@/lib/judge-panel-completion";

export function JudgingControls({
  competitionId,
  judgingOpen,
  appsOpen,
  claimed,
  released,
  closeProgress,
}: {
  competitionId: string;
  judgingOpen: boolean;
  appsOpen: boolean;
  claimed: boolean;
  released: boolean;
  closeProgress: { ready: boolean; missingScores: number; unsubmittedJudges: number; invalidPackets: number };
}) {
  const [state, formAction, pending] = useActionState(setJudgingOpen, undefined);

  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          Circuit ops · judging
        </p>
        <p className="mt-1 font-medium">
          {released
            ? "Results are final."
            : !claimed
            ? "This listing is unclaimed."
            : appsOpen
              ? "Applications are still open."
              : judgingOpen
                ? "Judging is open."
                : "Judging is closed."}
        </p>
        <p className="mt-1 text-sm text-muted">
          {!claimed
            ? "A competition admin has to claim it before you can open judging or watch live scores."
            : "Only tech admins can open or close judging. Opening it sets the shared team order. Closing requires every active judge to save all team scores and submit their packet; judges are locked while judging is closed."}
        </p>
      </div>
      <SaveNotice state={state} />
      {claimed ? (
        <div className="flex flex-wrap gap-2">
          <form action={formAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="competitionId" value={competitionId} />
            {judgingOpen ? (
              <>
                <input type="hidden" name="open" value="0" />
                <button className="btn btn-ghost" disabled={pending || !closeProgress.ready} type="submit">
                  {pending ? "Closing…" : "Close judging"}
                </button>
              </>
            ) : (
              <>
                <input type="hidden" name="open" value="1" />
                <button
                  className="btn btn-primary"
                  disabled={pending || appsOpen || released}
                  type="submit"
                >
                  {pending ? "Opening…" : "Open judging"}
                </button>
              </>
            )}
          </form>
        </div>
      ) : null}
      {claimed && appsOpen ? (
        <p className="text-sm text-muted">
          Close applications first. Judging cannot open while teams can still
          apply.
        </p>
      ) : null}
      {judgingOpen && !closeProgress.ready ? (
        <p className="text-sm text-muted">
          Before closing: {describePanelBlockers(closeProgress) || "at least one team and one active judge are required"}. A tech admin can remove an unavailable judge from the active panel during viewing.
        </p>
      ) : null}
    </div>
  );
}
