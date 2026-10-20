import { finalApplicationCutoff } from "@/lib/application-schedule";

/** Details a host must save before teams can see or apply to a competition. */
export const COMPETITION_REQUIRED_FIELDS = [
  { key: "dates", label: "Event dates" },
  { key: "location", label: "Location (city)" },
  { key: "venue", label: "Venue" },
  { key: "stageSize", label: "Stage size / dimensions" },
  { key: "lighting", label: "AV guidelines" },
  { key: "productionNotes", label: "Production notes" },
  { key: "description", label: "Competition bio" },
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

/** Explain every current blocker using the same visibility and cutoff rules as team applications. */
export function competitionApplicationClosureReasons(
  comp: CompetitionDetails & {
    claimedAt?: Date | null;
    userId?: string | null;
    acceptingApps: boolean;
    applicationDeadline: Date | null;
    applicationClosesAt?: Date | null;
    resultsReleasedAt?: Date | null;
  },
  now = new Date(),
): string[] {
  const reasons: string[] = [];
  if (!comp.claimedAt && !comp.userId) reasons.push("Not claimed by a host");
  const missing = competitionProfileGaps(comp);
  if (missing.length) reasons.push(`Comp Details incomplete: ${missing.join(", ")}`);
  if (comp.resultsReleasedAt) reasons.push("Results have been released");
  if (!comp.acceptingApps) reasons.push("Accepting Applications is turned off");
  const cutoff = finalApplicationCutoff(comp);
  if (cutoff && now > cutoff) reasons.push("Final application deadline has passed");
  return reasons;
}
