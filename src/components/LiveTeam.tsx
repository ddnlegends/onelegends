"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 3000;

type LiveState = { judgingOpen: boolean; livePosition: number | null };

function useLiveState(competitionId: string, initial: LiveState): LiveState {
  const [state, setState] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    const tick = async () => {
      try {
        const res = await fetch(`/api/live/${competitionId}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as LiveState;
          if (!cancelled) {
            setState((current) =>
              current.judgingOpen === data.judgingOpen &&
              current.livePosition === data.livePosition
                ? current
                : {
                    judgingOpen: data.judgingOpen,
                    livePosition: data.livePosition,
                  },
            );
          }
        }
      } catch {
        /* Network blip. Try again on the next tick. */
      }
      if (!cancelled) timeoutId = window.setTimeout(tick, POLL_MS);
    };

    timeoutId = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [competitionId]);

  return state;
}

export function LiveTeamFollower({
  competitionId,
  position,
  positions,
  pinned,
  initial,
  locked,
}: {
  competitionId: string;
  position: number;
  positions: number[];
  pinned: boolean;
  initial: LiveState;
  locked: boolean;
}) {
  const router = useRouter();
  const live = useLiveState(competitionId, initial);
  const livePosition =
    live.judgingOpen &&
    live.livePosition != null &&
    positions.includes(live.livePosition)
      ? live.livePosition
      : null;
  const shouldFollow =
    !pinned && !locked && livePosition != null && livePosition !== position;

  useEffect(() => {
    if (!shouldFollow || livePosition == null) return;
    router.replace(`/judge/${competitionId}/team/${livePosition}`, {
      scroll: false,
    });
  }, [shouldFollow, livePosition, competitionId, router]);

  if (locked) return null;

  if (livePosition == null) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-blush px-4 py-3 text-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-muted/50" />
        <span className="text-muted">
          {live.judgingOpen
            ? "Waiting for registration to put a team on screen. Your sheet switches on its own."
            : "Judging is closed right now."}
        </span>
      </div>
    );
  }

  if (livePosition === position) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-ember opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-ember" />
        </span>
        <span className="font-semibold text-accent">Live now</span>
        <span className="text-muted">
          Every judge is on Team {position}. This sheet follows registration.
        </span>
      </div>
    );
  }

  if (!pinned) {
    return (
      <div className="rounded-xl border border-line bg-blush px-4 py-3 text-sm text-muted">
        Switching to Team {livePosition}…
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-ember/40 bg-accent-ember/5 px-4 py-3 text-sm">
      <span>
        <span className="font-semibold text-accent-ember">
          Live is on Team {livePosition}.
        </span>{" "}
        <span className="text-muted">
          You’re looking at Team {position}, so this sheet won’t switch on its
          own.
        </span>
      </span>
      <Link
        href={`/judge/${competitionId}/team/${livePosition}`}
        prefetch
        replace
        scroll={false}
        className="btn btn-primary py-1.5"
      >
        Back to live team
      </Link>
    </div>
  );
}

export function LiveTeamBanner({
  competitionId,
  positions,
  initial,
  locked,
}: {
  competitionId: string;
  positions: number[];
  initial: LiveState;
  locked: boolean;
}) {
  const live = useLiveState(competitionId, initial);
  const livePosition =
    live.judgingOpen &&
    live.livePosition != null &&
    positions.includes(live.livePosition)
      ? live.livePosition
      : null;

  if (locked || !live.judgingOpen) return null;

  if (livePosition == null) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-blush px-4 py-4 text-sm text-muted">
        <span className="h-2.5 w-2.5 rounded-full bg-muted/50" />
        Waiting for registration to put the first team on screen.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-ember opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-accent-ember" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Live now</p>
          <p className="font-heading text-2xl text-accent">Team {livePosition}</p>
        </div>
      </div>
      <Link
        href={`/judge/${competitionId}/team/${livePosition}`}
        prefetch
        className="btn btn-primary"
      >
        Score Team {livePosition}
      </Link>
    </div>
  );
}
