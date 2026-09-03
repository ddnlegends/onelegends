"use client";

import { useActionState } from "react";
import { saveJudgeProfile } from "@/app/actions/judge";

export function JudgeProfileForm({
  profile,
  email,
}: {
  profile: { name: string; phone: string };
  email: string;
}) {
  const [state, formAction, pending] = useActionState(saveJudgeProfile, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card p-6">
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" value={email} disabled />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" required defaultValue={profile.name} />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile.phone}
            placeholder="555-0100"
          />
        </div>
      </div>
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">Profile saved.</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save Profile"}
      </button>
    </form>
  );
}
