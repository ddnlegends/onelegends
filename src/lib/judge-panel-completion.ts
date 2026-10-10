import { isScoreComplete, type PartialRubricScores } from "@/lib/judging-rules";

type PanelAssignment = {
  submittedAt: Date | null;
  slots: { applicationId: string; score: PartialRubricScores | null }[];
};

/** The same active-panel gate is used by ops closing and results finalization. */
export function judgePanelCompletion(
  applications: { id: string }[],
  activeJudges: PanelAssignment[],
) {
  const applicationIds = new Set(applications.map((application) => application.id));
  let missingScores = 0;
  let unsubmittedJudges = 0;
  let invalidPackets = 0;

  for (const judge of activeJudges) {
    const completed = new Set(
      judge.slots
        .filter((slot) => applicationIds.has(slot.applicationId) && isScoreComplete(slot.score))
        .map((slot) => slot.applicationId),
    );
    missingScores += applicationIds.size - completed.size;
    if (!judge.submittedAt) unsubmittedJudges += 1;
    if (judge.slots.length !== applicationIds.size ||
      judge.slots.some((slot) => !applicationIds.has(slot.applicationId))) {
      invalidPackets += 1;
    }
  }

  return {
    missingScores,
    unsubmittedJudges,
    invalidPackets,
    ready: applicationIds.size > 0 && activeJudges.length > 0 &&
      missingScores === 0 && unsubmittedJudges === 0 && invalidPackets === 0,
  };
}

export function describePanelBlockers(progress: ReturnType<typeof judgePanelCompletion>) {
  return [
    progress.missingScores ? `${progress.missingScores} team score sets missing` : null,
    progress.unsubmittedJudges ? `${progress.unsubmittedJudges} judge packets unsubmitted` : null,
    progress.invalidPackets ? `${progress.invalidPackets} packet layout issues` : null,
  ].filter(Boolean).join(", ");
}
