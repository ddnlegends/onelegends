"use client";

import { useActionState } from "react";
import { updateFeedbackStatus } from "@/app/actions/feedback";
import { FEEDBACK_STATUSES } from "@/lib/feedback";
import { SaveNotice } from "@/components/SaveNotice";

export function FeedbackStatusForm({ id, status }: { id: string; status: keyof typeof FEEDBACK_STATUSES }) {
  const [state, action, pending] = useActionState(updateFeedbackStatus, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="feedbackId" value={id} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="field">
          <label htmlFor={`status-${id}`}>Status</label>
          <select id={`status-${id}`} name="status" defaultValue={status} disabled={pending}>
            {Object.entries(FEEDBACK_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost" type="submit" disabled={pending}>{pending ? "Saving…" : "Save status"}</button>
      </div>
      <SaveNotice state={state} refresh={false} scroll={false} />
    </form>
  );
}
