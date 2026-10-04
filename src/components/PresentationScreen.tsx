"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DriveAvPlayer } from "@/components/DriveAvPlayer";

type LiveState = { judgingOpen: boolean; livePosition: number | null };
type TeamVideo = { position: number; avDriveUrl: string };

export function PresentationScreen({
  competitionId,
  teams,
  initial,
}: {
  competitionId: string;
  teams: TeamVideo[];
  initial: LiveState;
}) {
  const router = useRouter();
  const [live, setLive] = useState(initial);

  useEffect(() => {
    let active = true;
    let timer = 0;
    const poll = async () => {
      try {
        const response = await fetch(`/api/live/${competitionId}`, {
          cache: "no-store",
        });
        if (response.ok && active) {
          const state = (await response.json()) as LiveState;
          if (active) setLive(state);
        }
      } catch {
        // Keep the current screen during a brief connection loss.
      }
      if (active) timer = window.setTimeout(poll, 3000);
    };
    timer = window.setTimeout(poll, 3000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [competitionId]);

  const team = live.judgingOpen
    ? teams.find((row) => row.position === live.livePosition)
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl">
          {team ? `Team ${team.position}` : "Waiting for REG"}
        </h1>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.refresh()}
        >
          Refresh video link
        </button>
      </div>
      {team ? (
        <DriveAvPlayer
          key={`${team.position}-${team.avDriveUrl}`}
          url={team.avDriveUrl}
          label={`Team ${team.position} audition video`}
          hideOpenLink
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl border border-line bg-blush text-muted">
          The next video appears when REG selects a team.
        </div>
      )}
    </div>
  );
}
