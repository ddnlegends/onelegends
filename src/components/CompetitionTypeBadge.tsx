export function CompetitionTypeBadge({ isPartner }: { isPartner: boolean }) {
  return (
    <span className="inline-flex rounded-full border border-line bg-blush px-2 py-0.5 text-xs font-semibold text-accent">
      {isPartner ? "Partner" : "Non-partner"}
    </span>
  );
}
