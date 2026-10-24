"use client";

import { useActionState, useState } from "react";
import { ApplicationStatus } from "@prisma/client";
import { saveCompApplicantDecisions } from "@/app/actions/comp";
import { CompPaymentCheckbox } from "@/components/PaymentForms";
import { statusLabel } from "@/lib/utils";

type DecisionRow = {
  applicationId: string;
  teamName: string;
  rank?: number;
  status: ApplicationStatus;
  paymentStatus: "UNREVIEWED" | "PAID" | "UNPAID" | "WAIVED" | "LEGACY_INCLUDED";
};

const STATUSES: ApplicationStatus[] = [
  "PENDING",
  "ACCEPTED",
  "WAITLISTED",
  "DECLINED",
];

export function CompDecisionBoard({ rows, finalized }: { rows: DecisionRow[]; finalized: boolean }) {
  const [state, action, pending] = useActionState(saveCompApplicantDecisions, undefined);
  const [draft, setDraft] = useState(rows);
  const [acknowledged, setAcknowledged] = useState(false);
  const changed = draft.some((row, index) => row.status !== rows[index].status);
  const undecided = draft.filter((row) => row.status === "PENDING").length;

  if (finalized) {
    return <section className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div>
        <h2 className="font-heading text-2xl">Final team outcomes</h2>
        <p className="mt-1 text-sm text-muted">Decisions are locked and visible to teams. Host payments can still be updated.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-2xl text-left text-sm">
          <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Team</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Host payment</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => <tr key={row.applicationId} className="border-b border-line last:border-0">
              <th className="px-4 py-3 text-left font-semibold">{row.rank ? <span className="mr-2 text-accent">#{row.rank}</span> : null}{row.teamName}</th>
              <td className="px-4 py-3">{statusLabel(row.status)}</td>
              <td className="px-4 py-3">{row.status === "ACCEPTED"
                ? <CompPaymentCheckbox applicationId={row.applicationId} status={row.paymentStatus} />
                : "—"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>;
  }

  function updateStatus(applicationId: string, status: ApplicationStatus) {
    setDraft((current) => current.map((row) =>
      row.applicationId === applicationId
        ? { ...row, status }
        : row,
    ));
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Application decisions
          </p>
          <h2 className="font-heading text-2xl">Team outcomes</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">Save drafts privately. Choose an outcome for every team, then submit final decisions to reveal them to teams.</p>
        </div>
        <div className="rounded-full bg-blush px-3 py-1 text-xs font-semibold text-muted">
          {draft.filter((row) => row.status === "ACCEPTED").length} accepted · {undecided} undecided
        </div>
      </div>

      <form action={action} className="space-y-3">
        <input
          type="hidden"
          name="decisions"
          value={JSON.stringify(draft.map(({ applicationId, status }) => ({ applicationId, status })))}
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
                    <span className="text-muted">After final submission</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acknowledgeFinal" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          <span>I have reviewed an outcome for every team. I understand submitting final decisions makes them visible to teams and locks the outcomes.</span>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {state?.error ? <p className="text-danger">{state.error}</p> : null}
            {state?.ok ? <p className="text-success">{state.message}</p> : null}
            {changed ? <p className="text-warning">Unsaved changes</p> : null}
            {!changed && !state ? <p className="text-muted">Teams see Pending until final submission.</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" type="submit" name="intent" value="draft" disabled={pending || !changed}>
              {pending ? "Saving…" : "Save draft"}
            </button>
            <button className="btn btn-primary" type="submit" name="intent" value="final" disabled={pending || !acknowledged || undecided > 0 || draft.length === 0}>
              {pending ? "Submitting…" : `Submit final decisions (${draft.length})`}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
