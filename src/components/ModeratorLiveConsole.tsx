"use client";

/**
 * Moderator's live viewing console: Show / Next / Clear controls, the anonymous
 * viewing order, and a checkmark per judge per team. It receives Team numbers
 * and judge names only, never team names; the video player is passed in as
 * `children` by the Moderator page.
 */
import type { ReactNode } from "react";
import { useActionState } from "react";
import { setLiveTeam } from "@/app/actions/moderator";
import { SaveNotice } from "@/components/SaveNotice";

type TeamRow = {
  position: number;
  judges: { id: string; name: string; complete: boolean }[];
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

export function ModeratorLiveConsole({
  competitionId,
  teams,
  livePosition,
  children,
}: {
  competitionId: string;
  teams: TeamRow[];
  livePosition: number | null;
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
        {live ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">
                Now showing
              </p>
              <h2 className="font-heading text-3xl">Team {live.position}</h2>
            </div>
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
                  <p className="text-sm font-semibold">Team {team.position}</p>
                  {team.judges.length ? (
                    <ul
                      className="mt-2 space-y-1"
                      aria-label={`Team ${team.position} judge completion`}
                    >
                      {team.judges.map((judge) => (
                        <li
                          key={judge.id}
                          className="flex items-center justify-between gap-3 text-xs text-muted"
                        >
                          <span className="truncate">{judge.name}</span>
                          <span
                            aria-label={
                              judge.complete
                                ? `${judge.name} completed Team ${team.position}`
                                : `${judge.name} has not completed Team ${team.position}`
                            }
                            className={`grid size-5 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                              judge.complete
                                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                : "border-line bg-blush text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      No judges approved yet.
                    </p>
                  )}
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
