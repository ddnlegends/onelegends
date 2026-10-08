import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ApplyForm } from "@/components/ApplyForm";
import { isCompetitionOpen } from "@/lib/judging";
import { teamProfileGaps, TEAM_APPLY_OPS_BLOCKED_MESSAGE } from "@/lib/team-profile";
import { getActiveTeamId } from "@/lib/team-access";
import { formatDateTime } from "@/lib/utils";

export default async function TeamApplyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) redirect("/dashboard");

  const team = await prisma.teamProfile.findUnique({
    where: { id: teamId },
    include: { applications: true, dancers: true },
  });
  if (!team) redirect("/team");

  const gaps = teamProfileGaps(team);
  const competitions = await prisma.competitionProfile.findMany({
    where: { claimedAt: { not: null } },
    orderBy: [{ eventDate: "desc" }, { name: "asc" }],
  });
  const applied = new Set(team.applications.map((a) => a.competitionId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Apply</h1>
        <p className="mt-2 text-muted">
          Sending as <span className="text-ink">{team.name || "your team"}</span>.
          The full team profile and roster must be saved first.
        </p>
      </div>

      {team.applyBlocked ? (
        <p className="notice notice-error">{TEAM_APPLY_OPS_BLOCKED_MESSAGE}</p>
      ) : gaps.length ? (
        <div className="space-y-4 rounded-xl border border-line bg-card p-6">
          <p className="notice notice-error">
            Finish Team Profile before applying. Competitions need the complete
            packet: logo, blurb, AV, captains, years, and roster.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link href="/team/profile" className="btn btn-primary w-fit">
            Complete team profile
          </Link>
        </div>
      ) : competitions.length === 0 ? (
        <p className="text-muted">No comps available to apply.</p>
      ) : (
        <ApplyForm
          competitions={competitions.map((c) => ({
            id: c.id,
            name: c.name,
            isPartner: c.isPartner,
            dates: c.dates,
            location: c.location,
            venue: c.venue,
            earlyDeadline: c.earlyApplicationDeadline
              ? formatDateTime(c.earlyApplicationDeadline)
              : undefined,
            lateDeadline: c.applicationDeadline
              ? formatDateTime(c.applicationDeadline)
              : undefined,
            acceptingApps: isCompetitionOpen(c),
            alreadyApplied: applied.has(c.id),
          }))}
        />
      )}
    </div>
  );
}
