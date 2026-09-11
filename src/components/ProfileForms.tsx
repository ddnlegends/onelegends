"use client";

import { useActionState, useMemo, useState } from "react";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/app/actions/auth";
import { PASSWORD_RULES, passwordMeetsRules } from "@/lib/password";
import { SaveNotice } from "@/components/SaveNotice";

export function ProfileDetailsForm({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    undefined,
  );

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-line bg-card p-6"
    >
      <div>
        <h2 className="font-heading text-xl">Details</h2>
        <p className="mt-1 text-sm text-muted">
          This is your personal login, separate from a team or competition
          listing.
        </p>
      </div>
      <div className="field">
        <label htmlFor="profile-name">Name</label>
        <input
          id="profile-name"
          name="name"
          defaultValue={name}
          autoComplete="name"
          placeholder="Your name"
        />
      </div>
      <div className="field">
        <label htmlFor="profile-email">Email</label>
        <input
          id="profile-email"
          name="email"
          type="email"
          required
          defaultValue={email}
          autoComplete="email"
        />
      </div>
      <SaveNotice state={state} />
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    undefined,
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const allRulesMet = useMemo(() => passwordMeetsRules(password), [password]);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const canSubmit = allRulesMet && passwordsMatch;

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-line bg-card p-6"
    >
      <div>
        <h2 className="font-heading text-xl">Password</h2>
        <p className="mt-1 text-sm text-muted">
          Enter your current password, then choose a new one.
        </p>
      </div>
      <div className="field">
        <label htmlFor="currentPassword">Current password</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="field">
        <label htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          name="password"
          type="password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
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
        <label htmlFor="confirmNewPassword">Verify new password</label>
        <input
          id="confirmNewPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={10}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <p
        className={
          passwordsMatch
            ? "text-sm font-medium text-emerald-700"
            : "text-sm text-red-600"
        }
      >
        {passwordsMatch ? "✓ Passwords match" : "✕ Passwords must match"}
      </p>
      <SaveNotice state={state} />
      <button
        className="btn btn-primary"
        disabled={pending || !canSubmit}
        type="submit"
      >
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
