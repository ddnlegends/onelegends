import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getApprovedCompMemberships, isPlatformAdmin } from "@/lib/team-access";
import { isCompetitionVisibleToTeams } from "@/lib/competition-profile";
import { isCompetitionOpen } from "@/lib/judging";
import { formatApplicationFee } from "@/lib/competition-details";
import { formatDateTime } from "@/lib/utils";

export default async function AllCompetitionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (await isPlatformAdmin(session.user.id)) redirect("/dashboard");
  const memberships = await getApprovedCompMemberships(session.user.id);
  if (!memberships.length) redirect("/dashboard");

  const listings = await prisma.competitionProfile.findMany({
    where: { claimedAt: { not: null } },
    select: {
      id: true,
      name: true,
      isPartner: true,
      claimedAt: true,
      dates: true,
      location: true,
      venue: true,
      stageSize: true,
      lighting: true,
      productionNotes: true,
      description: true,
      acceptingApps: true,
      earlyApplicationDeadline: true,
      applicationDeadline: true,
      resultsReleasedAt: true,
      regularApplicationFeeCents: true,
      lateApplicationFeeCents: true,
    },
    orderBy: { name: "asc" },
  });
  const active = listings.filter((competition) =>
    isCompetitionVisibleToTeams(competition) && isCompetitionOpen(competition),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">All Competitions</h1>
        <p className="mt-2 text-muted">Competitions currently accepting applications. Compare host fees and deadlines; times appear in your time zone.</p>
      </div>
      {active.length === 0 ? <p className="text-muted">No competitions are accepting applications right now.</p> : null}
      {([true, false] as const).map((partner) => {
        const group = active.filter((competition) => competition.isPartner === partner);
        if (!group.length) return null;
        return (
          <section key={String(partner)} className="space-y-3" aria-label={partner ? "Partner Competitions" : "Non-partner Competitions"}>
            <h2 className="font-heading text-2xl">{partner ? "Partner Competitions" : "Non-partner Competitions"}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {group.map((competition) => (
                <article key={competition.id} className="space-y-3 rounded-xl border border-line bg-card p-5">
                  <div>
                    <h3 className="font-heading text-xl"><Link className="text-accent underline" href={`/comps/${competition.id}`}>{competition.name}</Link></h3>
                    <p className="text-sm text-muted">{[competition.dates, competition.location, competition.venue].filter(Boolean).join(" · ")}</p>
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="font-semibold">Regular deadline</dt><dd>{competition.earlyApplicationDeadline ? formatDateTime(competition.earlyApplicationDeadline) : "Not set"}</dd></div>
                    <div><dt className="font-semibold">Late deadline</dt><dd>{competition.applicationDeadline ? formatDateTime(competition.applicationDeadline) : "No automatic close"}</dd></div>
                    <div><dt className="font-semibold">Regular fee</dt><dd>{formatApplicationFee(competition.regularApplicationFeeCents)} per team</dd></div>
                    <div><dt className="font-semibold">Late fee</dt><dd>{formatApplicationFee(competition.lateApplicationFeeCents)} per team</dd></div>
                  </dl>
                  <Link className="text-sm text-accent underline" href={`/comps/${competition.id}`}>View details</Link>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
