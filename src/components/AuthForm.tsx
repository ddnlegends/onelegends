"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { loginAction, registerAction } from "@/app/actions/auth";
import { PASSWORD_RULES, passwordMeetsRules } from "@/lib/password";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const allRulesMet = useMemo(() => passwordMeetsRules(password), [password]);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const canRegister = allRulesMet && passwordsMatch;

  return (
    <form action={formAction} className="mx-auto max-w-md space-y-4 rounded-xl border border-line bg-card p-6">
      <p className="text-xs text-muted">
        One login for the whole circuit. After you sign in you land on your
        dashboard. Use Code Claim to attach a team or competition with a code.
      </p>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="shoutoutdukerhydhun@gmail.com"
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        {mode === "register" ? (
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        ) : (
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        )}
      </div>

      {mode === "register" ? (
        <>
          <ul className="space-y-1 text-sm">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li
                  key={rule.id}
                  className={ok ? "font-medium text-emerald-700" : "text-red-600"}
                >
                  {ok ? "✓" : "✕"} {rule.label}
                </li>
              );
            })}
          </ul>
          <div className="field">
            <label htmlFor="confirmPassword">Verify Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={10}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <p className={passwordsMatch ? "text-sm font-medium text-emerald-700" : "text-sm text-red-600"}>
            {passwordsMatch ? "✓ Passwords match" : "✕ Passwords must match"}
          </p>
        </>
      ) : null}

      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}

      <button
        className="btn btn-primary w-full"
        disabled={pending || (mode === "register" && !canRegister)}
        type="submit"
        onClick={() => {
          try {
            sessionStorage.removeItem("onelegends-invites-seen");
          } catch {
            /* ignore */
          }
        }}
      >
        {pending
          ? "Working…"
          : mode === "login"
            ? "Log In"
            : "Create Account"}
      </button>

      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/register" className="text-ink underline">
              Register
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-ink underline">
              Log In
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
