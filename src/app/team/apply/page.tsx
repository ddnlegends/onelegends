import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ApplyForm } from "@/components/ApplyForm";
import { isCompetitionOpen } from "@/lib/judging";
import { isCompetitionVisibleToTeams } from "@/lib/competition-profile";
import { teamProfileGaps, TEAM_APPLY_OPS_BLOCKED_MESSAGE } from "@/lib/team-profile";
import { getActiveTeamId } from "@/lib/team-access";

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
  const listings = await prisma.competitionProfile.findMany({
    where: { claimedAt: { not: null } },
    orderBy: [{ eventDate: "desc" }, { name: "asc" }],
  });
  const competitions = listings.filter(isCompetitionVisibleToTeams);
  const applied = new Set(team.applications.filter((a) => !a.removedAt).map((a) => a.competitionId));
  const withdrawn = new Set(team.applications.filter((a) => a.removedAt && a.removalReason === "Withdrawn by team").map((a) => a.competitionId));
  const adminRemoved = new Set(team.applications.filter((a) => a.removedAt && a.removalReason !== "Withdrawn by team").map((a) => a.competitionId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Apply</h1>
        <p className="mt-2 text-muted">
          {gaps.length ? "Browsing as" : "Sending as"} <span className="text-ink">{team.name || "your team"}</span>.
          The full team profile and roster must be saved first. You can apply before the $25 OneLegends registration fee is verified; that AV cannot enter viewing until tech admins mark the fee paid.
        </p>
      </div>

      {team.applyBlocked ? (
        <p className="notice notice-error">{TEAM_APPLY_OPS_BLOCKED_MESSAGE}</p>
      ) : (
        <>
          {gaps.length ? (
            <div className="space-y-4 rounded-xl border border-line bg-card p-6">
              <p className="notice notice-error">Complete your profile before applying. You can browse competition deadlines, fees, and application packets now.</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
                {gaps.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <Link href="/team/profile" className="btn btn-primary w-fit">Complete team profile</Link>
            </div>
          ) : null}
          {competitions.length === 0 ? (
            <p className="text-muted">No competitions are available to browse.</p>
          ) : (
            <ApplyForm
              browseOnly={gaps.length > 0}
              competitions={competitions.map((c) => ({
                id: c.id,
                name: c.name,
                isPartner: c.isPartner,
                isAffiliate: c.isAffiliate,
                dates: c.dates,
                location: c.location,
                venue: c.venue,
                earlyApplicationFeeCents: c.earlyApplicationFeeCents,
                regularApplicationFeeCents: c.regularApplicationFeeCents,
                lateApplicationFeeCents: c.lateApplicationFeeCents,
                earlyTierDeadline: c.earlyTierDeadline?.toISOString(),
                earlyDeadline: c.earlyApplicationDeadline
                  ? c.earlyApplicationDeadline.toISOString()
                  : undefined,
                lateDeadline: c.applicationDeadline
                  ? c.applicationDeadline.toISOString()
                  : undefined,
                finalCutoff: c.applicationClosesAt?.toISOString(),
                acceptingApps: isCompetitionOpen(c),
                alreadyApplied: applied.has(c.id),
                withdrawn: !applied.has(c.id) && withdrawn.has(c.id),
                adminRemoved: adminRemoved.has(c.id),
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
