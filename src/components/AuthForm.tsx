"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { googleSignInAction, loginAction } from "@/app/actions/auth";
import { PUBLIC_TEST_ACCOUNTS } from "@/lib/auth-policy";

export function AuthForm({
  mode,
  googleEnabled,
  testLoginEnabled = false,
}: {
  mode: "login" | "register";
  googleEnabled: boolean;
  testLoginEnabled?: boolean;
}) {
  const [state, testLoginAction, pending] = useActionState(loginAction, undefined);
  const [testEmail, setTestEmail] = useState("");

  return (
    <div className="mx-auto max-w-md space-y-5 rounded-xl border border-line bg-card p-6">
      <p className="text-sm text-muted">
        {mode === "register"
          ? "Sign in with Google to create your OneLegends account. Then use a claim code or accept an invitation to access your team or competition."
          : "Sign in with the Google account you registered with."}
      </p>

      {googleEnabled ? (
        <form action={googleSignInAction}>
          <input type="hidden" name="intent" value={mode} />
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
        <p className="text-center text-sm text-muted">
          New to OneLegends?{" "}
          <Link href="/register" className="text-ink underline">
            Create an account
          </Link>
        </p>
      ) : null}

      {mode === "login" && testLoginEnabled ? (
        <details className="rounded-lg border border-line p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Existing test account login
          </summary>
          <form action={testLoginAction} className="mt-4 space-y-4">
            <p className="text-xs text-muted">
              Choose a test role, then enter that account&apos;s password.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PUBLIC_TEST_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="btn btn-ghost px-2 py-2 text-xs"
                  onClick={() => setTestEmail(account.email)}
                >
                  {account.label}
                </button>
              ))}
            </div>
            <div className="field">
              <label htmlFor="test-email">Email</label>
              <input
                id="test-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
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
      ) : mode === "register" ? (
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-ink underline">
            Log in
          </Link>
        </p>
      ) : null}
    </div>
  );
}
