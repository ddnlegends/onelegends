export type CompetitionType = "partner" | "affiliate" | "non-partner";

export function competitionType(comp: { isPartner: boolean; isAffiliate: boolean }): CompetitionType {
  return comp.isAffiliate ? "affiliate" : comp.isPartner ? "partner" : "non-partner";
}

export function competitionTypeLabel(comp: { isPartner: boolean; isAffiliate: boolean }): string {
  const type = competitionType(comp);
  return type === "affiliate" ? "Affiliate" : type === "partner" ? "Partner" : "Non-partner";
}

export function usesAssignedModerator(comp: { isPartner: boolean; isAffiliate: boolean }): boolean {
  return comp.isPartner || comp.isAffiliate;
}

/** Partner and Affiliate judging both wait for tech validation and release. */
export const usesTechRelease = usesAssignedModerator;

/** Non-partner hosts may review submitted AVs and live team profiles before judging. */
export function hostCanViewApplicantDetails(comp: {
  isPartner: boolean;
  isAffiliate: boolean;
  resultsReleasedAt: Date | null;
}): boolean {
  return Boolean(comp.resultsReleasedAt) || !usesTechRelease(comp);
}

export const COMPETITION_TYPE_GROUPS: { type: CompetitionType; label: string }[] = [
  { type: "partner", label: "Partner Competitions" },
  { type: "affiliate", label: "Affiliate Competitions" },
  { type: "non-partner", label: "Non-partner Competitions" },
];
