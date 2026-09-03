"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { loginAction, registerAction } from "@/app/actions/auth";
import { PASSWORD_RULES, passwordMeetsRules } from "@/lib/password";

type Mode = "login" | "register";
type AccountRole = "TEAM" | "COMP" | "JUDGE";

export function AuthForm({
  mode,
  defaultRole = "TEAM",
}: {
  mode: Mode;
  defaultRole?: AccountRole;
}) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<AccountRole>(defaultRole);

  const allRulesMet = useMemo(() => passwordMeetsRules(password), [password]);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const canRegister = allRulesMet && passwordsMatch;

  const nameLabel = role === "TEAM" ? "Team Name" : "Your Name";

  return (
    <form action={formAction} className="mx-auto max-w-md space-y-4 rounded-xl border border-line bg-card p-6">
      <fieldset className="grid grid-cols-3 gap-2">
        {(
          [
            ["TEAM", "Team"],
            ["COMP", "Competition"],
            ["JUDGE", "Judge"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-2 py-2 text-sm sm:px-3"
          >
            <input
              type="radio"
              name="role"
              value={value}
              checked={role === value}
              onChange={() => setRole(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {mode === "login" ? (
        <p className="text-xs text-muted">
          Teams apply. Competitions claim an official listing with a bid code,
          then see counts until judging is complete. Judges score anonymous
          packets and never see team names.
        </p>
      ) : (
        <p className="text-xs text-muted">
          {role === "COMP"
            ? "Enter the claim code you were given for your bid competition. That links this login to the listing teams already see."
            : "Teams and judges create accounts here. Competitions must have an official claim code."}
        </p>
      )}

      {mode === "register" && role === "COMP" ? (
        <div className="field">
          <label htmlFor="claimCode">Competition Claim Code</label>
          <input
            id="claimCode"
            name="claimCode"
            required
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="LGND-7K2M"
          />
        </div>
      ) : null}

      {mode === "register" && role !== "COMP" ? (
        <div className="field">
          <label htmlFor="name">{nameLabel}</label>
          <input
            id="name"
            name="name"
            required
            placeholder={role === "TEAM" ? "Saffron Step" : "Priya Kapoor"}
          />
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
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
