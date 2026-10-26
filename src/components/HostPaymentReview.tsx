"use client";

import { useState } from "react";

type TeamPayment = { id: string; name: string; paid: boolean };

export function HostPaymentReview({
  teams,
}: {
  teams: TeamPayment[];
}) {
  const [open, setOpen] = useState(false);
  const paid = teams.filter((team) => team.paid).length;
  return (
    <section className="rounded-xl border border-line bg-blush p-5 text-sm">
      <h2 className="font-heading text-xl">Verify host payments before AV viewing</h2>
      <p className="mt-2 text-muted">
        {paid} of {teams.length} applicants marked paid to your competition. Teams not marked paid will not appear in AV viewing, even if their OneLegends fee is paid.
      </p>
      <button type="button" className="btn btn-primary mt-3" onClick={() => setOpen(true)}>
        Review host payments
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-label="Verify host payments" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-heading text-2xl">Verify every applicant’s host payment</h3>
              <button type="button" aria-label="Close payment review" className="btn btn-ghost py-1" onClick={() => setOpen(false)}>×</button>
            </div>
            <p className="mt-2 text-muted">Check the list below against payments your competition received. If a status is wrong, close this window, update it in Applied Teams, and return here. Unpaid teams will not appear in AV viewing.</p>
            <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
              {teams.map((team) => <li key={team.id} className="flex justify-between gap-3 px-4 py-3">
                <span>{team.name}</span>
                <span className={team.paid ? "font-semibold text-success" : "font-semibold text-warning"}>{team.paid ? "Paid for comp" : "Unpaid for comp"}</span>
              </li>)}
            </ul>
            <p className="mt-5 font-medium">Payment checkboxes on Applied Teams save each status. Tech admins will see the latest list before they open viewing.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>Done reviewing</button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Go back and update payments</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
