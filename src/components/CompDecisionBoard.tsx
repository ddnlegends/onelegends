"use client";

import { useActionState, useState } from "react";
import { ApplicationStatus } from "@prisma/client";
import { saveCompApplicantDecisions } from "@/app/actions/comp";
import { statusLabel } from "@/lib/utils";

type DecisionRow = {
  applicationId: string;
  teamName: string;
  rank?: number;
  status: ApplicationStatus;
  paymentReceived: boolean;
};

const STATUSES: ApplicationStatus[] = [
  "PENDING",
  "ACCEPTED",
  "WAITLISTED",
  "DECLINED",
];

export function CompDecisionBoard({ rows }: { rows: DecisionRow[] }) {
  const [state, action, pending] = useActionState(saveCompApplicantDecisions, undefined);
  const [draft, setDraft] = useState(rows);
  const changed = draft.some((row, index) => {
    const original = rows[index];
    return row.status !== original.status || row.paymentReceived !== original.paymentReceived;
  });

  function updateStatus(applicationId: string, status: ApplicationStatus) {
    setDraft((current) => current.map((row) =>
      row.applicationId === applicationId
        ? { ...row, status, paymentReceived: status === "ACCEPTED" ? row.paymentReceived : false }
        : row,
    ));
  }

  function updatePayment(applicationId: string, paymentReceived: boolean) {
    setDraft((current) => current.map((row) =>
      row.applicationId === applicationId ? { ...row, paymentReceived } : row,
    ));
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Decisions and payments
          </p>
          <h2 className="font-heading text-2xl">Team outcomes</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Set every outcome, mark host payments, then save the batch when the panel is ready.
          </p>
        </div>
        <div className="rounded-full bg-blush px-3 py-1 text-xs font-semibold text-muted">
          {draft.filter((row) => row.status === "ACCEPTED").length} accepted · {draft.filter((row) => row.paymentReceived).length} paid
        </div>
      </div>

      <form action={action} className="space-y-3">
        <input
          type="hidden"
          name="decisions"
          value={JSON.stringify(draft.map(({ applicationId, status, paymentReceived }) => ({ applicationId, status, paymentReceived })))}
          readOnly
        />
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Host payment</th>
              </tr>
            </thead>
            <tbody>
              {draft.map((row) => (
                <tr key={row.applicationId} className="border-b border-line last:border-0">
                  <th className="px-4 py-3 text-left font-semibold">
                    {row.rank ? <span className="mr-2 text-accent">#{row.rank}</span> : null}
                    {row.teamName}
                  </th>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-md border border-line bg-card px-3 py-2 text-sm"
                      value={row.status}
                      onChange={(event) => updateStatus(row.applicationId, event.target.value as ApplicationStatus)}
                      disabled={pending}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>{statusLabel(status)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <label className={`inline-flex items-center gap-2 ${row.status === "ACCEPTED" ? "" : "text-muted"}`}>
                      <input
                        type="checkbox"
                        checked={row.paymentReceived}
                        disabled={pending || row.status !== "ACCEPTED"}
                        onChange={(event) => updatePayment(row.applicationId, event.target.checked)}
                      />
                      Received
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {state?.error ? <p className="text-danger">{state.error}</p> : null}
            {state?.ok ? <p className="text-success">{state.message ?? "Decisions saved."}</p> : null}
            {!state && !changed ? <p className="text-muted">No unsaved changes.</p> : null}
            {changed ? <p className="text-warning">Unsaved changes</p> : null}
          </div>
          <button className="btn btn-primary" type="submit" disabled={pending || !changed}>
            {pending ? "Saving decisions…" : "Save decisions and payments"}
          </button>
        </div>
      </form>
    </section>
  );
}
