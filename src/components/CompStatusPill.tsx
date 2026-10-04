import { COMP_STATUS_LABEL, type CompStatus } from "@/lib/judging";

const STYLES: Record<CompStatus, string> = {
  UNCLAIMED: "border-line bg-blush text-muted",
  APPS_OPEN: "border-sky-200 bg-sky-50 text-sky-800",
  APPS_CLOSED: "border-amber-200 bg-amber-50 text-amber-800",
  READY: "border-violet-200 bg-violet-50 text-violet-800",
  LIVE: "border-accent-ember/40 bg-accent-ember/10 text-accent-ember",
  COMPLETE: "border-emerald-200 bg-emerald-50 text-emerald-800",
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
