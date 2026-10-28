import { competitionTypeLabel } from "@/lib/competition-type";

export function CompetitionTypeBadge({ isPartner, isAffiliate }: { isPartner: boolean; isAffiliate: boolean }) {
  return (
    <span className="inline-flex rounded-full border border-line bg-blush px-2 py-0.5 text-xs font-semibold text-accent">
      {competitionTypeLabel({ isPartner, isAffiliate })}
    </span>
  );
}
