"use client";

import { useActionState } from "react";
import { syncMySheet } from "@/app/actions/comp";

export function SyncSheetButton() {
  const [state, formAction, pending] = useActionState(
    async () => syncMySheet(),
    undefined,
  );

  return (
    <form action={formAction} className="space-y-2">
      <button className="btn btn-ghost" disabled={pending} type="submit">
        {pending ? "Syncing…" : "Sync Google Sheet"}
      </button>
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">{state.message}</p> : null}
    </form>
  );
}
