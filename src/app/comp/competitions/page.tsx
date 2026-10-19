import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getApprovedCompMemberships, isPlatformAdmin } from "@/lib/team-access";
import { isCompetitionVisibleToTeams } from "@/lib/competition-profile";
import { isCompetitionOpen } from "@/lib/judging";
import { formatApplicationFee } from "@/lib/competition-details";
import { ApplicationPeriodSummary } from "@/components/ApplicationPeriodSummary";
import { LocalDateTime } from "@/components/LocalDateTime";

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
      earlyTierDeadline: true,
      earlyApplicationDeadline: true,
      applicationDeadline: true,
      applicationClosesAt: true,
      resultsReleasedAt: true,
      earlyApplicationFeeCents: true,
      regularApplicationFeeCents: true,
      lateApplicationFeeCents: true,
    },
    orderBy: { name: "asc" },
  });
  const visible = listings.filter(isCompetitionVisibleToTeams);
  const open = visible.filter((competition) => isCompetitionOpen(competition));
  const closed = visible.filter((competition) => !isCompetitionOpen(competition));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">All Competitions</h1>
        <p className="mt-2 text-muted">Compare visible competitions, host fees, and deadlines. Times appear in your time zone.</p>
      </div>
      <h2 className="font-heading text-2xl">Accepting Applications</h2>
      {open.length === 0 ? <p className="text-muted">No competitions are accepting applications right now.</p> : null}
      {([true, false] as const).map((partner) => {
        const group = open.filter((competition) => competition.isPartner === partner);
        if (!group.length) return null;
        return (
          <section key={String(partner)} className="space-y-3" aria-label={partner ? "Partner Competitions" : "Non-partner Competitions"}>
            <h3 className="font-heading text-xl">{partner ? "Partner Competitions" : "Non-partner Competitions"}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {group.map((competition) => (
                <article key={competition.id} className="space-y-3 rounded-xl border border-line bg-card p-5">
                  <div>
                    <h3 className="font-heading text-xl"><Link className="text-accent underline" href={`/comps/${competition.id}`}>{competition.name}</Link></h3>
                    <p className="text-sm text-muted">{[competition.dates, competition.location, competition.venue].filter(Boolean).join(" · ")}</p>
                  </div>
                  <ApplicationPeriodSummary schedule={{
                    earlyDeadline: competition.earlyTierDeadline,
                    regularDeadline: competition.earlyApplicationDeadline,
                    lateDeadline: competition.applicationDeadline,
                    finalCutoff: competition.applicationClosesAt,
                    earlyFeeCents: competition.earlyApplicationFeeCents,
                    regularFeeCents: competition.regularApplicationFeeCents,
                    lateFeeCents: competition.lateApplicationFeeCents,
                  }} />
                  <Link className="text-sm text-accent underline" href={`/comps/${competition.id}`}>View details</Link>
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {closed.length ? (
        <section className="space-y-4" aria-label="Not accepting apps">
          <h2 className="font-heading text-2xl">Not accepting apps</h2>
          {([true, false] as const).map((partner) => {
            const group = closed.filter((competition) => competition.isPartner === partner);
            if (!group.length) return null;
            const label = partner ? "Partner Competitions" : "Non-partner Competitions";
            return (
              <section key={label} aria-label={`${label} not accepting applications`}>
                <h3 className="font-semibold">{label}</h3>
                <ul className="mt-3 space-y-5 text-sm text-muted">
                  {group.map((competition) => (
                    <li key={competition.id} className="leading-relaxed">
                      <Link className="font-medium text-accent underline" href={`/comps/${competition.id}`}>{competition.name}</Link>
                      {competition.dates ? ` — ${competition.dates}` : ""}
                      {competition.earlyTierDeadline ? <> · Early deadline <LocalDateTime date={competition.earlyTierDeadline} /></> : null}
                      {competition.earlyApplicationDeadline ? <> · Regular deadline <LocalDateTime date={competition.earlyApplicationDeadline} /></> : null}
                      {competition.applicationDeadline ? <> · Late deadline <LocalDateTime date={competition.applicationDeadline} /></> : null}
                      {competition.earlyTierDeadline || competition.earlyApplicationFeeCents !== null ? ` · Early fee ${formatApplicationFee(competition.earlyApplicationFeeCents)}` : null}
                      {` · Regular fee ${formatApplicationFee(competition.regularApplicationFeeCents)}`}
                      {` · Late fee ${formatApplicationFee(competition.lateApplicationFeeCents)}`}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
