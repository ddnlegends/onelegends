import type { ApplicationPhase } from "@prisma/client";

export type ApplicationSchedule = {
  earlyTierDeadline?: Date | null;
  earlyApplicationDeadline?: Date | null; // Existing Regular deadline column.
  applicationDeadline?: Date | null; // Existing Late deadline column.
  applicationClosesAt?: Date | null;
  earlyApplicationFeeCents?: number | null;
  regularApplicationFeeCents?: number | null;
  lateApplicationFeeCents?: number | null;
};

export function finalApplicationCutoff(schedule: ApplicationSchedule): Date | null {
  // Existing competitions retain their previous Late-only cutoff until a host edits dates.
  return schedule.applicationClosesAt ?? schedule.applicationDeadline ?? null;
}

export function latestConfiguredDeadline(schedule: ApplicationSchedule): Date | null {
  const dates = [schedule.earlyTierDeadline, schedule.earlyApplicationDeadline, schedule.applicationDeadline]
    .filter((date): date is Date => date != null);
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
}

export function applicationPhaseAt(schedule: ApplicationSchedule, at: Date): ApplicationPhase {
  if (schedule.earlyTierDeadline && at <= schedule.earlyTierDeadline) return "EARLY";
  if (schedule.earlyApplicationDeadline && at <= schedule.earlyApplicationDeadline) return "REGULAR";
  if (schedule.applicationDeadline) return "LATE";
  if (schedule.earlyApplicationDeadline) return "REGULAR";
  if (schedule.earlyTierDeadline) return "EARLY";
  return "REGULAR";
}

export function expectedApplicationFee(schedule: ApplicationSchedule, phase: ApplicationPhase): number | null {
  if (phase === "EARLY") return schedule.earlyApplicationFeeCents ?? null;
  if (phase === "LATE") return schedule.lateApplicationFeeCents ?? null;
  return schedule.regularApplicationFeeCents ?? null;
}

export function applicationPhaseLabel(phase: ApplicationPhase | null): string {
  if (phase === "EARLY") return "Early";
  if (phase === "LATE") return "Late";
  if (phase === "REGULAR") return "Regular";
  return "Not recorded";
}
