"use client";

import Link from "next/link";
import { useActionState } from "react";
import { googleSignInAction, loginAction } from "@/app/actions/auth";

export function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: "login" | "register";
  googleEnabled: boolean;
}) {
  const [state, testLoginAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="mx-auto max-w-md space-y-5 rounded-xl border border-line bg-card p-6">
      <p className="text-sm text-muted">
        {mode === "register"
          ? "Sign in with Google to create your OneLegends account. Then use a claim code or accept an invitation to access your team or competition."
          : "Sign in with Google to open your OneLegends dashboard."}
      </p>

      {googleEnabled ? (
        <form action={googleSignInAction}>
          <button className="btn btn-primary w-full" type="submit">
            Continue with Google
          </button>
        </form>
      ) : (
        <p className="notice notice-error">
          Google sign-in is not configured yet. Ask a Legends tech chair to
          finish the OAuth setup.
        </p>
      )}

      {mode === "login" ? (
        <details className="rounded-lg border border-line p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Existing test account login
          </summary>
          <form action={testLoginAction} className="mt-4 space-y-4">
            <p className="text-xs text-muted">
              Password sign-in is kept only for the existing demonstration accounts.
            </p>
            <div className="field">
              <label htmlFor="test-email">Email</label>
              <input
                id="test-email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="test-password">Password</label>
              <input
                id="test-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
            <button className="btn btn-ghost w-full" disabled={pending} type="submit">
              {pending ? "Signing in…" : "Sign in to test account"}
            </button>
          </form>
        </details>
      ) : (
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" prefetch className="text-ink underline">
            Log in
          </Link>
        </p>
      )}
    </div>
  );
}
