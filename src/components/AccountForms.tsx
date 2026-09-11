"use client";

import { useActionState, useEffect, useState } from "react";
import {
  acceptCompInvite,
  acceptJudgeInvite,
  acceptTeamInvite,
  cancelCompInvite,
  cancelJudgeInvite,
  cancelTeamInvite,
  previewCompClaim,
  previewTeamClaim,
  claimCompAction,
  claimTeamAction,
  createTeam,
  inviteCompAdmin,
  inviteJudge,
  inviteTeamAdmin,
  resetCompClaim,
  resetTeamClaim,
  revokeCompAccess,
  revokeTeamAccess,
} from "@/app/actions/team-access";
import { SaveNotice } from "@/components/SaveNotice";

export function ClaimTeamForm() {
  const [lookup, lookupAction, looking] = useActionState(
    previewTeamClaim,
    undefined,
  );
  const [claim, claimAction, claiming] = useActionState(
    claimTeamAction,
    undefined,
  );
  const [open, setOpen] = useState(false);

  const name = lookup?.name;
  const code = lookup?.claimCode;
  const showModal =
    open && !looking && Boolean(name && code) && !claim?.ok && !lookup?.error;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-5">
      <div>
        <h2 className="font-heading text-xl">Claim a team</h2>
        <p className="mt-1 text-sm text-muted">
          First person to use the code becomes the primary admin. The code
          cannot be reused after that.
        </p>
      </div>
      <form
        action={lookupAction}
        onSubmit={() => setOpen(true)}
        className="space-y-3"
      >
        <div className="field">
          <label htmlFor="team-claim-code">Team claim code</label>
          <input
            id="team-claim-code"
            name="claimCode"
            required
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="TEAM-XXXXXX"
          />
        </div>
        {lookup?.error ? <p className="notice notice-error">{lookup.error}</p> : null}
        {claim?.error ? <p className="notice notice-error">{claim.error}</p> : null}
        {claim?.ok ? <p className="notice notice-ok">{claim.message}</p> : null}
        <button className="btn btn-primary" disabled={looking} type="submit">
          {looking ? "Checking…" : "Claim team"}
        </button>
      </form>

      {showModal && name && code ? (
        <ClaimConfirmModal
          name={name}
          claimCode={code}
          pending={claiming}
          action={claimAction}
          onDecline={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

export function ClaimCompForm() {
  const [lookup, lookupAction, looking] = useActionState(
    previewCompClaim,
    undefined,
  );
  const [claim, claimAction, claiming] = useActionState(
    claimCompAction,
    undefined,
  );
  const [open, setOpen] = useState(false);

  const name = lookup?.name;
  const code = lookup?.claimCode;
  const showModal =
    open && !looking && Boolean(name && code) && !claim?.ok && !lookup?.error;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-5">
      <div>
        <h2 className="font-heading text-xl">Claim a competition</h2>
        <p className="mt-1 text-sm text-muted">
          Use the official bid code. First valid claim is the primary admin.
        </p>
      </div>
      <form
        action={lookupAction}
        onSubmit={() => setOpen(true)}
        className="space-y-3"
      >
        <div className="field">
          <label htmlFor="comp-claim-code">Competition claim code</label>
          <input
            id="comp-claim-code"
            name="claimCode"
            required
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="LGND-7K2M"
          />
        </div>
        {lookup?.error ? <p className="notice notice-error">{lookup.error}</p> : null}
        {claim?.error ? <p className="notice notice-error">{claim.error}</p> : null}
        {claim?.ok ? <p className="notice notice-ok">{claim.message}</p> : null}
        <button className="btn btn-primary" disabled={looking} type="submit">
          {looking ? "Checking…" : "Claim competition"}
        </button>
      </form>

      {showModal && name && code ? (
        <ClaimConfirmModal
          name={name}
          claimCode={code}
          pending={claiming}
          action={claimAction}
          onDecline={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ClaimConfirmModal({
  name,
  claimCode,
  pending,
  action,
  onDecline,
}: {
  name: string;
  claimCode: string;
  pending: boolean;
  action: (formData: FormData) => void;
  onDecline: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-[0_24px_80px_rgba(142,28,66,0.18)]">
        <p
          id="claim-confirm-title"
          className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted"
        >
          Are you sure you want to claim:
        </p>
        <p className="mt-4 font-heading text-3xl tracking-[0.04em] text-accent sm:text-4xl">
          {name}
        </p>
        <form action={action} className="mt-8 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="claimCode" value={claimCode} />
          <button className="btn btn-primary flex-1" disabled={pending} type="submit">
            {pending ? "Claiming…" : "Approve"}
          </button>
          <button
            className="btn flex-1 border border-line bg-white text-ink"
            type="button"
            onClick={onDecline}
          >
            Decline
          </button>
        </form>
      </div>
    </div>
  );
}

export function AcceptTeamInviteForm({
  membershipId,
  label = "Approve",
}: {
  membershipId: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(acceptTeamInvite, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <button className="btn btn-primary py-1.5" disabled={pending} type="submit">
        {pending ? "…" : label}
      </button>
      {state?.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function AcceptCompInviteForm({
  membershipId,
  label = "Approve",
}: {
  membershipId: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(acceptCompInvite, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <button className="btn btn-primary py-1.5" disabled={pending} type="submit">
        {pending ? "…" : label}
      </button>
      {state?.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function AcceptJudgeInviteForm({
  inviteId,
  label = "Approve",
}: {
  inviteId: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(acceptJudgeInvite, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <button className="btn btn-primary py-1.5" disabled={pending} type="submit">
        {pending ? "…" : label}
      </button>
      {state?.error ? <p className="mt-1 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function InviteTeamAdminForm({ teamId }: { teamId: string }) {
  const [state, formAction, pending] = useActionState(inviteTeamAdmin, undefined);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (state?.ok) setEmail("");
  }, [state?.ok]);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="teamId" value={teamId} />
        <div className="field min-w-0 flex-1">
          <label htmlFor={`team-admin-email-${teamId}`}>
            Invite a secondary admin
          </label>
          <input
            id={`team-admin-email-${teamId}`}
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@school.edu"
          />
        </div>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
      <SaveNotice state={state} />
    </form>
  );
}

export function InviteCompAdminForm({ competitionId }: { competitionId: string }) {
  const [state, formAction, pending] = useActionState(inviteCompAdmin, undefined);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (state?.ok) setEmail("");
  }, [state?.ok]);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="competitionId" value={competitionId} />
        <div className="field min-w-0 flex-1">
          <label htmlFor={`comp-admin-email-${competitionId}`}>
            Invite a secondary admin
          </label>
          <input
            id={`comp-admin-email-${competitionId}`}
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="director@comp.org"
          />
        </div>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
      <SaveNotice state={state} />
    </form>
  );
}

export function InviteJudgeForm({ competitionId }: { competitionId: string }) {
  const [state, formAction, pending] = useActionState(inviteJudge, undefined);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (state?.ok) setEmail("");
  }, [state?.ok]);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-line bg-card p-5"
    >
      <input type="hidden" name="competitionId" value={competitionId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="field min-w-0 w-full flex-1">
          <label htmlFor="judge-email">Invite a judge by email</label>
          <input
            id="judge-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="judge@school.edu"
          />
        </div>
        <button
          className="btn btn-primary shrink-0"
          disabled={pending}
          type="submit"
        >
          {pending ? "Sending…" : "Invite judge"}
        </button>
      </div>
      <p className="text-sm text-muted">
        No email is sent. They approve the invite the next time they log in.
      </p>
      <SaveNotice state={state} />
    </form>
  );
}

export function RevokeTeamAccessForm({ membershipId }: { membershipId: string }) {
  const [state, formAction, pending] = useActionState(revokeTeamAccess, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">
        {pending ? "…" : "Remove"}
      </button>
      {state?.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function RevokeCompAccessForm({ membershipId }: { membershipId: string }) {
  const [state, formAction, pending] = useActionState(revokeCompAccess, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">
        {pending ? "…" : "Remove"}
      </button>
      {state?.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function CancelTeamInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState(cancelTeamInvite, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">
        {pending ? "…" : "Cancel"}
      </button>
      {state?.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function CancelJudgeInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState(cancelJudgeInvite, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">
        {pending ? "…" : "Cancel"}
      </button>
      {state?.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function CancelCompInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState(cancelCompInvite, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">
        {pending ? "…" : "Cancel"}
      </button>
      {state?.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function CreateTeamForm() {
  const [state, formAction, pending] = useActionState(createTeam, undefined);
  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card p-6">
      <div>
        <h2 className="font-heading text-xl">Add a team</h2>
        <p className="mt-1 text-sm text-muted">
          Creating a team generates a claim code. Give that code to the
          captain. This app does not email anyone.
        </p>
      </div>
      <div className="field">
        <label htmlFor="team-name">Team name</label>
        <input id="team-name" name="name" required minLength={2} placeholder="Duke Rhydhun" />
      </div>
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? (
        <p className="notice notice-ok">
          {state.message}
          {state.claimCode ? (
            <>
              {" "}
              <span className="font-mono font-semibold">{state.claimCode}</span>
            </>
          ) : null}
        </p>
      ) : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}

export function ResetTeamClaimForm({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(resetTeamClaim, undefined);

  if (!confirming) {
    return (
      <div>
        <button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(true)}>
          Reset claim
        </button>
        {state?.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
        {state?.ok ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-line bg-blush p-3">
      <input type="hidden" name="teamId" value={teamId} />
      <p className="text-sm">
        Are you sure? This removes every admin from <strong>{teamName}</strong>{" "}
        and re-opens the claim code. Someone else can become the new primary.
      </p>
      <div className="flex gap-2">
        <button className="btn btn-primary py-1.5" disabled={pending} type="submit">
          {pending ? "Resetting…" : "Yes, reset claim"}
        </button>
        <button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
      {state?.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function ResetCompClaimForm({
  competitionId,
  competitionName,
}: {
  competitionId: string;
  competitionName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(resetCompClaim, undefined);

  if (!confirming) {
    return (
      <div>
        <button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(true)}>
          Reset claim
        </button>
        {state?.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
        {state?.ok ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-line bg-blush p-3">
      <input type="hidden" name="competitionId" value={competitionId} />
      <p className="text-sm">
        Are you sure? This removes every admin from{" "}
        <strong>{competitionName}</strong> and re-opens the bid code.
      </p>
      <div className="flex gap-2">
        <button className="btn btn-primary py-1.5" disabled={pending} type="submit">
          {pending ? "Resetting…" : "Yes, reset claim"}
        </button>
        <button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
      {state?.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
