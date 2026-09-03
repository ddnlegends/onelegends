"use client";

import { useActionState } from "react";
import { setRequiredJudgeCount } from "@/app/actions/comp-judging";

export function RequiredJudgeCountForm({
  value,
  completed,
  released,
}: {
  value: number;
  completed: number;
  released: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    setRequiredJudgeCount,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-line bg-card p-5">
      <div className="field max-w-xs">
        <label htmlFor="requiredJudgeCount">Required Judges (N)</label>
        <input
          id="requiredJudgeCount"
          name="requiredJudgeCount"
          type="number"
          min={1}
          max={50}
          required
          defaultValue={value}
        />
      </div>
      <p className="text-sm text-muted">
        {completed} of {value} required judges have submitted.
        {released
          ? " Named results are unlocked on Viewing Results."
          : " Lower N to this completed count if you need to release early."}
      </p>
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">Judge count saved.</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save Judge Count"}
      </button>
    </form>
  );
}
