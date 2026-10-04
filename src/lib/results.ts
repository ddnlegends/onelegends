import {
  isScoreComplete,
  rubricTotal,
  scoreComment,
  zScores,
  type PartialRubricScores,
  type RubricScores,
} from "@/lib/judging";

export type RankedJudge = {
  judgeName: string;
  scores: RubricScores;
  total: number;
  z: number;
  comment: string;
};

export type RankedTeam = {
  applicationId: string;
  teamId: string;
  name: string;
  status: "PENDING" | "ACCEPTED" | "WAITLISTED" | "DECLINED";
  viewingPosition: number | null;
  judges: RankedJudge[];
  avgTotal: number;
  avgZ: number;
};

type AppInput = {
  id: string;
  teamId: string;
  status: RankedTeam["status"];
  viewingPosition: number | null;
  team: { name: string };
};

type AssignmentInput = {
  judge: { name: string };
  slots: Array<{
    applicationId: string;
    score: (PartialRubricScores & { comment?: string | null }) | null;
  }>;
};

/** Rank by each judge's z-score (normalizes harsh vs. generous judges), then raw average. */
export function rankTeams(
  applications: AppInput[],
  submittedAssignments: AssignmentInput[],
): RankedTeam[] {
  const byApplication = new Map<string, RankedTeam>();
  for (const app of applications) {
    byApplication.set(app.id, {
      applicationId: app.id,
      teamId: app.teamId,
      name: app.team.name,
      status: app.status,
      viewingPosition: app.viewingPosition,
      judges: [],
      avgTotal: 0,
      avgZ: 0,
    });
  }

  for (const assignment of submittedAssignments) {
    const scored = assignment.slots.filter(
      (
        slot,
      ): slot is typeof slot & {
        score: RubricScores & { comment?: string | null };
      } => isScoreComplete(slot.score),
    );
    const totals = scored.map((slot) => rubricTotal(slot.score));
    const zs = zScores(totals);
    scored.forEach((slot, index) => {
      const row = byApplication.get(slot.applicationId);
      if (!row) return;
      row.judges.push({
        judgeName: assignment.judge.name,
        scores: {
          choreography: slot.score.choreography,
          formations: slot.score.formations,
          technique: slot.score.technique,
          syncCleanliness: slot.score.syncCleanliness,
          overallImpression: slot.score.overallImpression,
        },
        total: totals[index],
        z: zs[index],
        comment: scoreComment(slot.score),
      });
    });
  }

  return [...byApplication.values()]
    .map((row) => {
      const count = row.judges.length;
      const avgTotal =
        count === 0 ? 0 : row.judges.reduce((sum, j) => sum + j.total, 0) / count;
      const avgZ =
        count === 0 ? 0 : row.judges.reduce((sum, j) => sum + j.z, 0) / count;
      return { ...row, avgTotal, avgZ };
    })
    .sort((a, b) => b.avgZ - a.avgZ || b.avgTotal - a.avgTotal);
}
