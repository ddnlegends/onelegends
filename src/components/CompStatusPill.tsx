import { COMP_STATUS_LABEL, type CompStatus } from "@/lib/judging";

const STYLES: Record<CompStatus, string> = {
  UNCLAIMED: "border-line bg-blush text-muted",
  APPS_OPEN: "border-info-line bg-info-soft text-info",
  APPS_CLOSED: "border-warning-line bg-warning-soft text-warning",
  READY: "border-ready-line bg-ready-soft text-ready",
  LIVE: "border-accent-ember/40 bg-accent-ember/10 text-accent-ember",
  COMPLETE: "border-success-line bg-success-soft text-success",
};

export function CompStatusPill({ status }: { status: CompStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${STYLES[status]}`}
    >
      {status === "LIVE" ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-ember opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-ember" />
        </span>
      ) : null}
      {COMP_STATUS_LABEL[status]}
    </span>
  );
}
