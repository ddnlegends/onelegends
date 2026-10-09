"use client";

import { JudgeScoreForm } from "@/components/JudgeScoreForm";
import { LiveTeamFollower, useLiveState, type LiveState } from "@/components/LiveTeam";

type Saved = {
  choreography: number | null;
  formations: number | null;
  technique: number | null;
  syncCleanliness: number | null;
  overallImpression: number | null;
  comment?: string | null;
};

export function JudgeLiveScoring({
  competitionId,
  assignmentId,
  position,
  positions,
  prevPosition,
  nextPosition,
  pinned,
  submitted,
  locked,
  saved,
  initial,
}: {
  competitionId: string;
  assignmentId: string;
  position: number;
  positions: number[];
  prevPosition: number | null;
  nextPosition: number | null;
  pinned: boolean;
  submitted: boolean;
  locked: boolean;
  saved: Saved | null;
  initial: LiveState;
}) {
  const live = useLiveState(competitionId, initial, !submitted);
  const scoreAvailable = live.judgingOpen && live.livePosition != null && position <= live.livePosition;

  return (
    <>
      <LiveTeamFollower
        competitionId={competitionId}
        position={position}
        positions={positions}
        pinned={pinned}
        live={live}
        locked={locked}
      />
      <JudgeScoreForm
        competitionId={competitionId}
        assignmentId={assignmentId}
        position={position}
        prevPosition={prevPosition}
        nextPosition={nextPosition}
        saved={saved}
        locked={locked}
        scoreAvailable={scoreAvailable}
        livePosition={live.judgingOpen ? live.livePosition : null}
      />
    </>
  );
}
