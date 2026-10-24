"use client";

import { useActionState, useRef } from "react";
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
  paymentSummary,
}: {
  competitionId: string;
  judgingOpen: boolean;
  appsOpen: boolean;
  claimed: boolean;
  released: boolean;
  closeProgress: { ready: boolean; missingScores: number; unsubmittedJudges: number; invalidPackets: number };
  paymentSummary: { verified: boolean; included: number; hostUnpaid: number; oneLegendsUnpaid: number; unreviewed: number };
}) {
  const [state, formAction, pending] = useActionState(setJudgingOpen, undefined);
  const dialog = useRef<HTMLDialogElement>(null);

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
          {judgingOpen ? <form action={formAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="competitionId" value={competitionId} />
              <>
                <input type="hidden" name="open" value="0" />
                <button className="btn btn-ghost" disabled={pending || !closeProgress.ready} type="submit">
                  {pending ? "Closing…" : "Close judging"}
                </button>
              </>
          </form> : <>
            <button className="btn btn-primary" type="button" disabled={appsOpen || released} onClick={() => dialog.current?.showModal()}>Open judging</button>
            <dialog ref={dialog} className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-2xl border border-line bg-card p-6 text-ink shadow-xl backdrop:bg-black/50">
              <div className="flex justify-between gap-3"><h3 className="font-heading text-2xl">Before AV viewing</h3><button className="btn btn-ghost py-1" type="button" aria-label="Close viewing verification" onClick={() => dialog.current?.close()}>✕</button></div>
              <p className="mt-3 text-sm">Host payment review: {paymentSummary.verified ? "verified" : "not verified"}. {paymentSummary.included} teams can enter the viewing order; {paymentSummary.hostUnpaid} are host unpaid, {paymentSummary.oneLegendsUnpaid} have unpaid OneLegends registration, and {paymentSummary.unreviewed} remain unreviewed.</p>
              <p className="mt-3 rounded-lg border border-warning-line bg-warning-soft p-3 text-sm">Unpaid teams will not show up in AV viewing. Confirm the host reviewed every team and circuit ops verified OneLegends payments.</p>
              <form action={formAction} className="mt-5 flex flex-wrap gap-2">
                <input type="hidden" name="competitionId" value={competitionId} />
                <input type="hidden" name="open" value="1" />
                <input type="hidden" name="paymentConfirmation" value="CONFIRM" />
                <button className="btn btn-primary" disabled={pending || !paymentSummary.verified || paymentSummary.unreviewed > 0 || paymentSummary.included === 0} type="submit">{pending ? "Opening…" : "Confirm and open viewing"}</button>
                <button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
              </form>
              {!paymentSummary.verified ? <p className="mt-3 text-sm text-warning">Competition admins need to finish verification on Applied Teams.</p> : null}
            </dialog>
          </>}
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
