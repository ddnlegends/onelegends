"use client";

import { useActionState } from "react";
import { submitJudgingPacket } from "@/app/actions/judge";

export function SubmitPacketButton({
  assignmentId,
  ready,
  closed = false,
}: {
  assignmentId: string;
  ready: boolean;
  closed?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    submitJudgingPacket,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? (
        <p className="notice notice-ok">Packet submitted. You cannot edit scores now.</p>
      ) : null}
      <button
        className="btn btn-primary"
        disabled={pending || !ready || closed}
        type="submit"
      >
        {pending ? "Submitting…" : "Submit Judging"}
      </button>
      {closed ? (
        <p className="text-sm text-muted">
          Judging is closed. You can review, but you cannot submit until
          circuit ops opens it again.
        </p>
      ) : !ready ? (
        <p className="text-sm text-muted">
          Save scores for every team before you submit the packet.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Once you submit, scores are locked. The competition only sees names
          after every required judge has submitted.
        </p>
      )}
    </form>
  );
}
