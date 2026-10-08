"use client";

import { useActionState, useEffect, useState } from "react";

function clearEmailAfterSuccess(
  state: { ok?: boolean } | undefined,
  seen: { ok?: boolean } | undefined,
  setSeen: (next: { ok?: boolean } | undefined) => void,
  setEmail: (value: string) => void,
) {
  if (state === seen) return;
  setSeen(state);
  if (state?.ok) setEmail("");
}
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
  createCompetition,
  createTeam,
  inviteCompAdmin,
  inviteJudge,
  inviteTeamAdmin,
  resetCompClaim,
  resetTeamClaim,
  setTeamApplyBlock,
  revokeCompAccess,
  revokeTeamAccess,
} from "@/app/actions/team-access";
import {
  cancelPlatformAdminInvite,
  cancelRegistrationInvite,
  grantRegistrationAccess,
  invitePlatformAdmin,
  removeRegistrationAccess,
  revokePlatformAdmin,
} from "@/app/actions/ops-admin";
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 text-center shadow-[0_24px_80px_rgba(142,28,66,0.18)]">
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
            className="btn flex-1 border border-line bg-card text-ink"
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
      {state?.error ? <p className="mt-1 text-xs text-danger">{state.error}</p> : null}
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
      {state?.error ? <p className="mt-1 text-xs text-danger">{state.error}</p> : null}
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
      {state?.error ? <p className="mt-1 text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function InviteTeamAdminForm({ teamId }: { teamId: string }) {
  const [state, formAction, pending] = useActionState(inviteTeamAdmin, undefined);
  const [email, setEmail] = useState("");
  const [seen, setSeen] = useState(state);
  clearEmailAfterSuccess(state, seen, setSeen, setEmail);

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
  const [seen, setSeen] = useState(state);
  clearEmailAfterSuccess(state, seen, setSeen, setEmail);

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
  const [seen, setSeen] = useState(state);
  clearEmailAfterSuccess(state, seen, setSeen, setEmail);

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
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
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
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
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
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
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
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
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
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function CreateTeamForm() {
  const [state, formAction, pending] = useActionState(createTeam, undefined);

  useEffect(() => {
    if (!state?.ok || !state.teamId) return;
    const id = `ops-team-${state.teamId}`;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state?.ok, state?.teamId]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card p-6">
      <div>
        <h2 className="font-heading text-xl">Add a team</h2>
        <p className="mt-1 text-sm text-muted">
          Creating a team generates a claim code. Manage it from the Teams
          page. This app does not email anyone.
        </p>
      </div>
      <div className="field">
        <label htmlFor="team-name">Team name</label>
        <input id="team-name" name="name" required minLength={2} placeholder="Duke Rhydhun" />
      </div>
      <SaveNotice state={state} scroll={false} />
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}

export function CreateCompForm() {
  const [state, formAction, pending] = useActionState(
    createCompetition,
    undefined,
  );

  useEffect(() => {
    if (!state?.ok || !state.competitionId) return;
    const id = `ops-comp-${state.competitionId}`;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state?.ok, state?.competitionId]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card p-6">
      <div>
        <h2 className="font-heading text-xl">Add a competition</h2>
        <p className="mt-1 text-sm text-muted">
          Creating a competition generates a bid code. Manage it from the
          Competitions page. Teams cannot apply until someone claims it. This
          app does not email anyone.
        </p>
      </div>
      <div className="field">
        <label htmlFor="comp-name">Competition name</label>
        <input
          id="comp-name"
          name="name"
          required
          minLength={2}
          placeholder="Buckeye Mela"
        />
      </div>
      <SaveNotice state={state} scroll={false} />
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create competition"}
      </button>
    </form>
  );
}

export function SetTeamApplyBlockForm({
  teamId,
  teamName,
  blocked,
  reason,
}: {
  teamId: string;
  teamName: string;
  blocked: boolean;
  reason: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(setTeamApplyBlock, undefined);

  if (blocked) {
    return (
      <form action={formAction} className="space-y-3 rounded-md border border-line bg-blush p-3">
        <input type="hidden" name="teamId" value={teamId} />
        <div className="field">
          <label htmlFor={`block-reason-${teamId}`}>Reason visible to circuit admins</label>
          <textarea
            id={`block-reason-${teamId}`}
            name="reason"
            maxLength={500}
            defaultValue={reason}
            placeholder="Unpaid dues, MOU pending, or another circuit issue"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary py-1.5" disabled={pending} type="submit" name="blocked" value="1">
            {pending ? "Saving…" : "Save reason"}
          </button>
          <button className="btn btn-ghost py-1.5" disabled={pending} type="submit" name="blocked" value="0">
            Unblock applying
          </button>
        </div>
        <SaveNotice state={state} />
      </form>
    );
  }

  if (!confirming) {
    return (
      <div>
        <button
          className="btn btn-ghost py-1.5"
          type="button"
          onClick={() => setConfirming(true)}
        >
          Block applying
        </button>
        <SaveNotice state={state} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-line bg-blush p-3">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="blocked" value="1" />
      <p className="text-sm">
        Block <strong>{teamName}</strong> from applying? Use this for unpaid
        dues or a rules issue. They will see that circuit ops blocked them.
        Existing applications stay on file.
      </p>
      <div className="field">
        <label htmlFor={`new-block-reason-${teamId}`}>Reason visible to circuit admins</label>
        <textarea
          id={`new-block-reason-${teamId}`}
          name="reason"
          required
          maxLength={500}
          placeholder="Explain the dues, MOU, or rules issue"
        />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary py-1.5" disabled={pending} type="submit">
          {pending ? "Blocking…" : "Yes, block applying"}
        </button>
        <button
          className="btn btn-ghost py-1.5"
          type="button"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </div>
      <SaveNotice state={state} />
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
        {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
        {state?.ok ? <p className="text-xs text-success">{state.message}</p> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-line bg-blush p-3">
      <input type="hidden" name="teamId" value={teamId} />
      <p className="text-sm">
        Are you sure? This removes every admin from <strong>{teamName}</strong>{" "}
        and issues a new claim code (the old one stops working). Whoever uses
        the new code becomes the primary.
      </p>
      <div className="flex gap-2">
        <button className="btn btn-primary py-1.5" disabled={pending} type="submit">
          {pending ? "Resetting…" : "Yes, reset claim"}
        </button>
        <button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
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
        {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
        {state?.ok ? <p className="text-xs text-success">{state.message}</p> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-line bg-blush p-3">
      <input type="hidden" name="competitionId" value={competitionId} />
      <p className="text-sm">
        Are you sure? This removes every admin from{" "}
        <strong>{competitionName}</strong>, its judges, and REG access, then
        issues a new bid code (the old one stops working).
      </p>
      <div className="flex gap-2">
        <button className="btn btn-primary py-1.5" disabled={pending} type="submit">
          {pending ? "Resetting…" : "Yes, reset claim"}
        </button>
        <button className="btn btn-ghost py-1.5" type="button" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function InvitePlatformAdminForm() {
  const [state, formAction, pending] = useActionState(
    invitePlatformAdmin,
    undefined,
  );
  const [email, setEmail] = useState("");
  const [seen, setSeen] = useState(state);
  clearEmailAfterSuccess(state, seen, setSeen, setEmail);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="field min-w-0 flex-1">
          <label htmlFor="ops-admin-email">Invite a tech admin</label>
          <input
            id="ops-admin-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="legendstech@desidancenetwork.org"
          />
        </div>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
      <p className="text-sm text-muted">
        No email is sent. They become tech admin as soon as they log in or
        register with this address.
      </p>
      <SaveNotice state={state} />
    </form>
  );
}

export function CancelPlatformAdminInviteForm({
  inviteId,
}: {
  inviteId: string;
}) {
  const [state, formAction, pending] = useActionState(
    cancelPlatformAdminInvite,
    undefined,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">
        {pending ? "…" : "Cancel"}
      </button>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function GrantRegistrationForm({
  competitions,
}: {
  competitions: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    grantRegistrationAccess,
    undefined,
  );
  const [email, setEmail] = useState("");
  const [seen, setSeen] = useState(state);
  clearEmailAfterSuccess(state, seen, setSeen, setEmail);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="field min-w-0">
          <label htmlFor="reg-competition">Competition</label>
          <select id="reg-competition" name="competitionId" required defaultValue="">
            <option value="" disabled>
              Pick a competition
            </option>
            {competitions.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field min-w-0">
          <label htmlFor="reg-email">Registration email</label>
          <input
            id="reg-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="legendstestreg@gmail.com"
          />
        </div>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Granting…" : "Grant REG"}
        </button>
      </div>
      <p className="text-sm text-muted">
        No email is sent. REG accounts play the videos and pick the team judges
        score. If the account does not exist yet, access applies when they log
        in or register.
      </p>
      <SaveNotice state={state} />
    </form>
  );
}

export function RemoveRegistrationAccessForm({ accessId }: { accessId: string }) {
  const [state, formAction, pending] = useActionState(
    removeRegistrationAccess,
    undefined,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="accessId" value={accessId} />
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">
        {pending ? "…" : "Remove"}
      </button>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function CancelRegistrationInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState(
    cancelRegistrationInvite,
    undefined,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">
        {pending ? "…" : "Cancel"}
      </button>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function RevokePlatformAdminForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(
    revokePlatformAdmin,
    undefined,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <button className="btn btn-ghost py-1.5" disabled={pending} type="submit">
        {pending ? "…" : "Remove"}
      </button>
      {state?.error ? <p className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
