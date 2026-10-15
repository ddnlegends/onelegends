"use client";

import { useActionState } from "react";
import { SaveNotice } from "@/components/SaveNotice";
import {
  markAllRegistrationPaid,
  removeUnpaidApplication,
  setCompPaymentReceived,
  setRegistrationPaid,
} from "@/app/actions/payments";

export function MarkAllRegistrationPaidForm({ unpaidTeams, unpaidCompetitions }: { unpaidTeams: number; unpaidCompetitions: number }) {
  const [state, action, pending] = useActionState(markAllRegistrationPaid, undefined);
  const unpaidCount = unpaidTeams + unpaidCompetitions;

  return (
    <form
      action={action}
      className="flex flex-col items-start gap-2"
      onSubmit={(event) => {
        if (!window.confirm(`Mark all ${unpaidCount} unpaid OneLegends registration fees paid? Confirm that you have received every payment.`)) {
          event.preventDefault();
        }
      }}
    >
      <button className="btn btn-primary" disabled={pending || unpaidCount === 0} type="submit">
        {pending ? "Marking paid…" : "Mark All Paid"}
      </button>
      <span className="text-xs text-muted">
        {unpaidCount} unpaid · {unpaidTeams} teams, {unpaidCompetitions} competitions
      </span>
      <SaveNotice state={state} scroll={false} />
    </form>
  );
}

export function RegistrationPaymentForm({ kind, id, paid }: { kind: "team" | "competition"; id: string; paid: boolean }) {
  const [state, action, pending] = useActionState(setRegistrationPaid, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost py-1.5" name="paid" value={paid ? "0" : "1"} disabled={pending} type="submit">
        {pending ? "Saving…" : paid ? "Mark unpaid" : "Mark paid"}
      </button>
      {state?.error ? <span className="text-xs text-danger">{state.error}</span> : null}
      {state?.ok ? <span className="text-xs text-muted">{state.message}</span> : null}
    </form>
  );
}

export function RemoveApplicationForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(removeUnpaidApplication, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="field">
        <label htmlFor={`remove-${applicationId}`}>Removal reason</label>
        <input id={`remove-${applicationId}`} name="reason" required maxLength={500} placeholder="OneLegends fee unpaid" />
      </div>
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">{pending ? "Removing…" : "Remove application"}</button>
      {state?.error ? <span className="text-xs text-danger">{state.error}</span> : null}
      {state?.ok ? <span className="text-xs text-muted">{state.message}</span> : null}
    </form>
  );
}

export function CompPaymentCheckbox({ applicationId, received }: { applicationId: string; received: boolean }) {
  const [state, action, pending] = useActionState(setCompPaymentReceived, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="received"
          value="1"
          defaultChecked={received}
          disabled={pending}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
        Payment received
      </label>
      <button className="btn btn-ghost py-1.5 text-xs" disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</button>
      {state?.error ? <span className="text-xs text-danger">{state.error}</span> : null}
      {state?.ok ? <span className="text-xs text-muted">Saved</span> : null}
    </form>
  );
}
