"use client";

import { signOutAction } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="text-sm text-muted hover:text-ink">
        Sign Out
      </button>
    </form>
  );
}
