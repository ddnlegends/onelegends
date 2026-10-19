import { LocalDateTime } from "@/components/LocalDateTime";
import { formatApplicationFee } from "@/lib/competition-details";

export type ApplicationPeriodDisplay = {
  earlyDeadline?: Date | string | null;
  regularDeadline?: Date | string | null;
  lateDeadline?: Date | string | null;
  finalCutoff?: Date | string | null;
  earlyFeeCents?: number | null;
  regularFeeCents?: number | null;
  lateFeeCents?: number | null;
};

export function ApplicationPeriodSummary({ schedule }: { schedule: ApplicationPeriodDisplay }) {
  const finalCutoff = schedule.finalCutoff ?? schedule.lateDeadline;
  const periods = [
    { label: "Early", deadline: schedule.earlyDeadline, fee: schedule.earlyFeeCents, color: "border-success-line bg-success-soft" },
    { label: "Regular", deadline: schedule.regularDeadline, fee: schedule.regularFeeCents, color: "border-info-line bg-info-soft" },
    { label: "Late", deadline: schedule.lateDeadline, fee: schedule.lateFeeCents, color: "border-warning-line bg-warning-soft" },
  ].filter((period) => period.deadline || period.fee != null);

  if (!periods.length) return <p className="text-sm text-muted">Deadlines and host fees have not been announced.</p>;

  return <div className="grid gap-3 md:grid-cols-3">
    {periods.map((period) => {
      const isFinal = Boolean(period.deadline && finalCutoff &&
        new Date(period.deadline).getTime() === new Date(finalCutoff).getTime());
      return <section key={period.label} className={`rounded-lg border px-3 py-3 ${period.color}`}>
        <h3 className="text-xs font-semibold uppercase tracking-wide">{period.label}{isFinal ? " · final cutoff" : ""}</h3>
        <dl className="mt-2 space-y-2 text-sm">
          <div><dt className="text-xs text-muted">Deadline</dt><dd className="font-medium">{period.deadline ? <LocalDateTime date={period.deadline} /> : "Not set"}</dd></div>
          <div><dt className="text-xs text-muted">Host fee · per team</dt><dd className="font-medium">{formatApplicationFee(period.fee ?? null)}</dd></div>
        </dl>
      </section>;
    })}
  </div>;
}
