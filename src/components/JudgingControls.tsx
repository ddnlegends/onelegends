"use client";

import { useActionState, useState } from "react";
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
  paymentRows,
  paymentFingerprint,
}: {
  competitionId: string;
  judgingOpen: boolean;
  appsOpen: boolean;
  claimed: boolean;
  released: boolean;
  closeProgress: { ready: boolean; missingScores: number; unsubmittedJudges: number; invalidPackets: number };
  paymentRows: { id: string; name: string; paid: boolean }[];
  paymentFingerprint: string;
}) {
  const [state, formAction, pending] = useActionState(setJudgingOpen, undefined);
  const [reviewingPayments, setReviewingPayments] = useState(false);

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
          {judgingOpen ? (
            <form action={formAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="competitionId" value={competitionId} />
              <input type="hidden" name="open" value="0" />
              <button className="btn btn-ghost" disabled={pending || !closeProgress.ready} type="submit">
                {pending ? "Closing…" : "Close judging"}
              </button>
            </form>
          ) : (
            <button type="button" className="btn btn-primary" disabled={appsOpen || released} onClick={() => setReviewingPayments(true)}>Open judging</button>
          )}
        </div>
      ) : null}
      {reviewingPayments && !judgingOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
        <div role="dialog" aria-modal="true" aria-label="Verify host payments before viewing" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-heading text-2xl">Check host payments before AV viewing</h2>
            <button type="button" className="btn btn-ghost py-1" aria-label="Close payment verification" onClick={() => setReviewingPayments(false)}>×</button>
          </div>
          <p className="mt-2 text-sm text-muted">Competition admins mark who paid their competition. Review this list with them before opening judging. Teams not marked paid will not appear in AV viewing. You can close this window and return after they update it.</p>
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {paymentRows.map((row) => <li key={row.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
              <span>{row.name}</span><span className={row.paid ? "font-semibold text-success" : "font-semibold text-warning"}>{row.paid ? "Paid for comp" : "Unpaid for comp"}</span>
            </li>)}
          </ul>
          <form action={formAction} className="mt-5 space-y-3">
            <input type="hidden" name="competitionId" value={competitionId} />
            <input type="hidden" name="open" value="1" />
            <input type="hidden" name="confirmation" value="HOST_PAYMENTS_REVIEWED" />
            <input type="hidden" name="paymentFingerprint" value={paymentFingerprint} />
            <p className="text-sm font-medium">I checked the host payment list and understand unpaid teams will be excluded.</p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={pending || !paymentRows.length}>{pending ? "Opening…" : "Confirm and open judging"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setReviewingPayments(false)}>Go back and verify</button>
            </div>
          </form>
        </div>
      </div> : null}
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
