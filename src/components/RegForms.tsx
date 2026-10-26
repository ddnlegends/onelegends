"use client";

import { useActionState } from "react";
import { saveRegFollowUp, setRegAssignment, setRegAvReviewed } from "@/app/actions/reg";
import { SaveNotice } from "@/components/SaveNotice";

type Contact = { email: string; name: string; pending?: boolean };

export function RegAssignmentForm({ competitionId, currentEmail, contacts }: {
  competitionId: string; currentEmail: string | null; contacts: Contact[];
}) {
  const [state, action, pending] = useActionState(setRegAssignment, undefined);
  return <form action={action} className="flex flex-wrap items-center gap-2">
    <input type="hidden" name="competitionId" value={competitionId} />
    <label className="sr-only" htmlFor={`reg-${competitionId}`}>Reg chair</label>
    <select id={`reg-${competitionId}`} name="email" defaultValue={currentEmail ?? ""} className="input max-w-xs">
      <option value="">Unassigned</option>
      {contacts.map((contact) => <option value={contact.email} key={contact.email}>{contact.name} ({contact.email}){contact.pending ? " · waiting to log in" : ""}</option>)}
    </select>
    <button type="submit" className="btn btn-ghost" disabled={pending}>Save</button>
    <SaveNotice state={state} scroll={false} />
  </form>;
}

export function RegFollowUpForm({ competitionId, note }: { competitionId: string; note: string }) {
  const [state, action, pending] = useActionState(saveRegFollowUp, undefined);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="competitionId" value={competitionId} />
    <label htmlFor="reg-follow-up" className="block text-sm font-semibold">Follow-up note</label>
    <textarea id="reg-follow-up" name="note" defaultValue={note} maxLength={3000} rows={4} className="input w-full" placeholder="What needs attention?" />
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="contacted" /> I contacted this competition now</label>
    <button className="btn btn-primary" disabled={pending}>Save tracking</button>
    <SaveNotice state={state} />
  </form>;
}

export function RegAvReviewForm({ competitionId }: { competitionId: string }) {
  const [state, action, pending] = useActionState(setRegAvReviewed, undefined);
  return <form action={action} className="space-y-2">
    <input type="hidden" name="competitionId" value={competitionId} />
    <button className="btn btn-primary" disabled={pending}>Mark submitted AVs reviewed</button>
    <SaveNotice state={state} />
  </form>;
}
