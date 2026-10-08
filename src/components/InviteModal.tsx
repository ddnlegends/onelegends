"use client";

import { useState } from "react";
import {
  AcceptCompInviteForm,
  AcceptJudgeInviteForm,
  AcceptTeamInviteForm,
} from "@/components/AccountForms";

type TeamInvite = { id: string; teamName: string };
type CompInvite = { id: string; competitionName: string };
type JudgeInvite = { id: string; competitionName: string };

export function InviteModal({
  teams,
  comps,
  judges,
}: {
  teams: TeamInvite[];
  comps: CompInvite[];
  judges: JudgeInvite[];
}) {
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem("onelegends-invites-seen") === "1";
    } catch {
      return false;
    }
  });

  if (hidden) return null;
  if (teams.length + comps.length + judges.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-[0_24px_80px_rgba(142,28,66,0.18)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
          Waiting on you
        </p>
        <h2 id="invite-modal-title" className="mt-2 font-heading text-2xl tracking-[0.06em]">
          You have requests to approve
        </h2>
        <p className="mt-2 text-sm text-muted">
          Clicking outside this window will not dismiss it. Approve here, or
          review later on your dashboard — the request stays until you approve.
        </p>

        {teams.length ? (
          <section className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold">Team requests</h3>
            <ul className="space-y-2">
              {teams.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                >
                  <span>{item.teamName}</span>
                  <AcceptTeamInviteForm membershipId={item.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {comps.length ? (
          <section className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold">Competition requests</h3>
            <ul className="space-y-2">
              {comps.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                >
                  <span>{item.competitionName}</span>
                  <AcceptCompInviteForm membershipId={item.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {judges.length ? (
          <section className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold">Judging invites</h3>
            <ul className="space-y-2">
              {judges.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                >
                  <span>Judge {item.competitionName}</span>
                  <AcceptJudgeInviteForm inviteId={item.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <button
          type="button"
          className="btn btn-ghost mt-6 w-full"
          onClick={() => {
            try {
              sessionStorage.setItem("onelegends-invites-seen", "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
        >
          I’ll review later on the dashboard
        </button>
      </div>
    </div>
  );
}
