"use client";

import { useActionState } from "react";
import { withdrawTeamApplication } from "@/app/actions/team";

export function WithdrawApplicationForm({ applicationId, competitionName }: {
  applicationId: string;
  competitionName: string;
}) {
  const [state, action, pending] = useActionState(withdrawTeamApplication, undefined);
  return (
    <form
      action={action}
      className="flex flex-col items-start gap-1"
      onSubmit={(event) => {
        if (!window.confirm(`Withdraw your application to ${competitionName}? You can reapply while applications are open, at the phase and fee then in effect.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <button className="btn btn-ghost py-1.5 text-sm" disabled={pending} type="submit">
        {pending ? "Withdrawing…" : "Withdraw application"}
      </button>
      {state?.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
