"use client";

import { useActionState, useRef } from "react";
import { setCompPaymentReceived, verifyCompPayments } from "@/app/actions/payments";
import { SaveNotice } from "@/components/SaveNotice";

type PaymentStatus = "UNREVIEWED" | "PAID" | "UNPAID" | "WAIVED" | "LEGACY_INCLUDED";
type Row = { id: string; teamName: string; status: PaymentStatus; oneLegendsPaid: boolean };

function PaymentRow({ row, locked }: { row: Row; locked: boolean }) {
  const [state, action, pending] = useActionState(setCompPaymentReceived, undefined);
  return <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
    <div>
      <p className="font-medium">{row.teamName}</p>
      <p className="text-xs text-muted">OneLegends: {row.oneLegendsPaid ? "paid" : "unpaid"} · Host: {row.status === "LEGACY_INCLUDED" ? "historical viewing (unreviewed payment)" : row.status.toLowerCase()}</p>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </div>
    {!locked ? <form action={action} className="flex flex-wrap gap-2">
      <input type="hidden" name="applicationId" value={row.id} />
      {(["PAID", "UNPAID", "WAIVED"] as const).map((status) => <button key={status} className={`btn py-1.5 text-xs ${row.status === status ? "btn-primary" : "btn-ghost"}`} name="status" value={status} disabled={pending} type="submit">{status === "WAIVED" ? "Fee waived" : status === "PAID" ? "Paid" : "Unpaid"}</button>)}
    </form> : null}
  </li>;
}

export function HostPaymentReview({ competitionId, rows, verified, locked }: {
  competitionId: string;
  rows: Row[];
  verified: boolean;
  locked: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(verifyCompPayments, undefined);
  const unreviewed = rows.filter((row) => row.status === "UNREVIEWED").length;
  const hostExcluded = rows.filter((row) => row.status === "UNPAID").length;
  const oneLegendsExcluded = rows.filter((row) => !row.oneLegendsPaid).length;
  const included = rows.filter((row) => row.oneLegendsPaid && (row.status === "PAID" || row.status === "WAIVED")).length;
  return <section className="space-y-4 rounded-xl border border-line bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-heading text-2xl">Host payment review before AV viewing</h2>
        <p className="mt-1 text-sm text-muted">Mark every team paid, unpaid, or fee waived for this competition. This is separate from OneLegends registration payment, which circuit tech admins verify.</p>
      </div>
      <button className="btn btn-primary" type="button" disabled={locked || !rows.length} onClick={() => dialog.current?.showModal()}>{verified ? "Review verification" : "Verify payments"}</button>
    </div>
    <p className="rounded-lg border border-warning-line bg-warning-soft p-3 text-sm">Unpaid teams will not appear in AV viewing. Teams also need their separate OneLegends payment verified.</p>
    <p className="text-sm text-muted">{included} included · {hostExcluded} host unpaid · {oneLegendsExcluded} OneLegends unpaid · {unreviewed} not reviewed{verified ? " · Host review verified" : ""}</p>
    <ul className="rounded-lg border border-line">{rows.map((row) => <PaymentRow key={row.id} row={row} locked={locked} />)}</ul>
    {locked ? <p className="text-sm text-muted">Viewing order is frozen. Final accepted-team payments can still be tracked after decisions are submitted.</p> : null}
    <dialog ref={dialog} className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-2xl border border-line bg-card p-6 text-ink shadow-xl backdrop:bg-black/50">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-2xl">Verify host payments</h3>
        <button className="btn btn-ghost py-1" type="button" aria-label="Close payment verification" onClick={() => dialog.current?.close()}>✕</button>
      </div>
      <p className="mt-3 text-sm">{included} teams will be included based on current payment records. {hostExcluded} marked host unpaid and {oneLegendsExcluded} awaiting OneLegends payment will not show in AV viewing.</p>
      {unreviewed ? <p className="mt-3 notice notice-error">{unreviewed} team{unreviewed === 1 ? " is" : "s are"} still unreviewed. Close this window to return to the list and mark them.</p> : null}
      <form action={action} className="mt-5 flex flex-wrap gap-2">
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="confirmation" value="VERIFY" />
        <button className="btn btn-primary" type="submit" disabled={pending || unreviewed > 0}>{pending ? "Verifying…" : "Confirm payment review"}</button>
        <button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel and check teams</button>
      </form>
      <SaveNotice state={state} scroll={false} />
    </dialog>
  </section>;
}
