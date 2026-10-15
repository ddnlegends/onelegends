/** Details a host must save before teams can see or apply to a competition. */
export const COMPETITION_REQUIRED_FIELDS = [
  { key: "dates", label: "Event dates" },
  { key: "location", label: "Location (city)" },
  { key: "venue", label: "Venue" },
  { key: "stageSize", label: "Stage size / dimensions" },
  { key: "lighting", label: "Lighting" },
  { key: "productionNotes", label: "Production notes" },
  { key: "description", label: "Comp details" },
] as const;

export type CompetitionDetails = Record<(typeof COMPETITION_REQUIRED_FIELDS)[number]["key"], string>;

export function competitionProfileGaps(comp: CompetitionDetails): string[] {
  return COMPETITION_REQUIRED_FIELDS
    .filter(({ key }) => !comp[key].trim())
    .map(({ label }) => label);
}

export function isCompetitionVisibleToTeams(comp: CompetitionDetails & {
  claimedAt?: Date | null;
  userId?: string | null;
}): boolean {
  return Boolean(comp.claimedAt || comp.userId) && competitionProfileGaps(comp).length === 0;
}
