"use client";

import Link from "next/link";
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
  competitionPaid,
  competitionFee,
  orderLocked,
  paymentRows,
  paymentFingerprint,
}: {
  competitionId: string;
  judgingOpen: boolean;
  appsOpen: boolean;
  claimed: boolean;
  released: boolean;
  closeProgress: { ready: boolean; missingScores: number; unsubmittedJudges: number; invalidPackets: number };
  competitionPaid: boolean;
  competitionFee: string;
  orderLocked: boolean;
  paymentRows: {
    id: string;
    name: string;
    hostPaid: boolean;
    teamPaid: boolean;
    blocked: boolean;
    expectedHostFee: string;
    teamFee: string;
    included: boolean;
  }[];
  paymentFingerprint: string;
}) {
  const [state, formAction, pending] = useActionState(setJudgingOpen, undefined);
  const [reviewingPayments, setReviewingPayments] = useState(false);
  const includedCount = paymentRows.filter((row) => row.included).length;

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
        <div role="dialog" aria-modal="true" aria-label="Verify host payments before viewing" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-heading text-2xl">Check all payments before AV viewing</h2>
            <button type="button" className="btn btn-ghost py-1" aria-label="Close payment verification" onClick={() => setReviewingPayments(false)}>×</button>
          </div>
          <p className="mt-2 text-sm text-muted">Review the competition and every active applicant before opening judging. {orderLocked ? "The existing viewing order is frozen; later host payment changes do not add or remove teams." : "Only unblocked teams marked paid to both OneLegends and the host enter AV viewing."} Host payments are recorded as received or unpaid; compare the expected amount with your outside payment records.</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-blush px-4 py-3 text-sm">
            <span>Competition OneLegends fee: <strong>{competitionFee}</strong> · <strong className={competitionPaid ? "text-success" : "text-warning"}>{competitionPaid ? "Paid" : "Unpaid"}</strong></span>
            <span className="font-semibold">{includedCount} of {paymentRows.length} teams in viewing</span>
          </div>
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {paymentRows.map((row) => <li key={row.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{row.name}</span>
                <span className={row.included ? "font-semibold text-success" : "font-semibold text-warning"}>{row.included ? "In viewing" : row.blocked ? "Excluded · blocked" : "Excluded from viewing"}</span>
              </div>
              <div className="grid gap-1 text-muted sm:grid-cols-2">
                <span>OneLegends team fee {row.teamFee}: <strong className={row.teamPaid ? "text-success" : "text-warning"}>{row.teamPaid ? "Paid" : "Unpaid"}</strong></span>
                <span>Host fee expected {row.expectedHostFee}: <strong className={row.hostPaid ? "text-success" : "text-warning"}>{row.hostPaid ? "Paid for comp" : "Unpaid for comp"}</strong></span>
              </div>
            </li>)}
          </ul>
          {!paymentRows.length ? <p className="mt-3 text-sm text-muted">No active applications.</p> : null}
          <form action={formAction} className="mt-5 space-y-3">
            <input type="hidden" name="competitionId" value={competitionId} />
            <input type="hidden" name="open" value="1" />
            <input type="hidden" name="confirmation" value="HOST_PAYMENTS_REVIEWED" />
            <input type="hidden" name="paymentFingerprint" value={paymentFingerprint} />
            <p className="text-sm font-medium">I checked the OneLegends and host payment statuses and understand excluded teams will not enter this viewing order.</p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={pending || !competitionPaid || !includedCount}>{pending ? "Opening…" : "Confirm and open judging"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setReviewingPayments(false)}>Go back and verify</button>
              <Link href="/ops/payments" className="btn btn-ghost">Review OneLegends payments</Link>
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
