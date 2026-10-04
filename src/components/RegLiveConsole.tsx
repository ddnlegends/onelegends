"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState } from "react";
import { setLiveTeam } from "@/app/actions/registration";
import { SaveNotice } from "@/components/SaveNotice";

type TeamRow = {
  position: number;
  name: string;
  judgesDone: number;
};

function ShowButton({
  action,
  pending,
  competitionId,
  position,
  label,
  primary = false,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  competitionId: string;
  position: number | "";
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="position" value={position} />
      <button
        type="submit"
        disabled={pending}
        className={`btn ${primary ? "btn-primary" : "btn-ghost"} py-1.5`}
      >
        {label}
      </button>
    </form>
  );
}

export function RegLiveConsole({
  competitionId,
  teams,
  livePosition,
  judgeCount,
  children,
}: {
  competitionId: string;
  teams: TeamRow[];
  livePosition: number | null;
  judgeCount: number;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(setLiveTeam, undefined);
  const index = teams.findIndex((team) => team.position === livePosition);
  const live = index >= 0 ? teams[index] : null;
  const prev = index > 0 ? teams[index - 1] : null;
  const next =
    index >= 0 ? (teams[index + 1] ?? null) : (teams[0] ?? null);
  const shared = { action: formAction, pending, competitionId };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="space-y-4">
        <Link
          href={`/reg/${competitionId}/present`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Open video-only presentation tab
        </Link>
        {live ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">
                On screen · judges see “Team {live.position}”
              </p>
              <h2 className="font-heading text-3xl">{live.name}</h2>
            </div>
            <p className="rounded-full border border-line bg-blush px-3 py-1 text-sm tabular-nums">
              {live.judgesDone} / {judgeCount} judges fully scored
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">
              Nothing on screen
            </p>
            <h2 className="font-heading text-3xl">Ready when you are</h2>
            <p className="mt-1 text-sm text-muted">
              Start with Team {teams[0]?.position ?? 1}. Judges’ sheets switch
              as soon as you press Show.
            </p>
          </div>
        )}

        {children}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
          {prev ? (
            <ShowButton
              {...shared}
              position={prev.position}
              label={`← Team ${prev.position}`}
            />
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            {live ? (
              <ShowButton {...shared} position="" label="Clear screen" />
            ) : null}
            {next ? (
              <ShowButton
                {...shared}
                position={next.position}
                label={live ? `Next: Team ${next.position} →` : `Show Team ${next.position}`}
                primary
              />
            ) : live ? (
              <span className="self-center text-sm text-muted">
                Last team. Judges can submit once every sheet is scored.
              </span>
            ) : null}
          </div>
        </div>
        <SaveNotice state={state} refresh={false} scroll={false} />
        {pending ? <p className="text-xs text-muted">Switching judges…</p> : null}
      </section>

      <aside className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Viewing order
        </h3>
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {teams.map((team) => {
            const isLive = team.position === livePosition;
            return (
              <li
                key={team.position}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                  isLive ? "bg-accent/5" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    <span className="mr-1.5 tabular-nums text-muted">
                      {team.position}.
                    </span>
                    {team.name}
                  </p>
                  <p className="text-xs text-muted">
                    {team.judgesDone} / {judgeCount} scored
                  </p>
                </div>
                {isLive ? (
                  <span className="rounded-full bg-accent-ember px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
                    Live
                  </span>
                ) : (
                  <ShowButton {...shared} position={team.position} label="Show" />
                )}
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
