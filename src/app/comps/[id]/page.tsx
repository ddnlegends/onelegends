import { PageShell } from "@/components/PageShell";
import { CompetitionTypeBadge } from "@/components/CompetitionTypeBadge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isCompetitionOpen } from "@/lib/judging";
import { isCompetitionVisibleToTeams } from "@/lib/competition-profile";
import { getActiveTeamId, userHasTeamAccess } from "@/lib/team-access";
import { TEAM_APPLY_OPS_BLOCKED_MESSAGE } from "@/lib/team-profile";
import { ApplicationPeriodSummary } from "@/components/ApplicationPeriodSummary";
import type { ReactNode } from "react";

export default async function CompPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const canApply =
    session?.user && (await userHasTeamAccess(session.user.id));
  let applyBlocked = false;
  if (session?.user) {
    const teamId = await getActiveTeamId(session.user.id);
    if (teamId) {
      const active = await prisma.teamProfile.findUnique({
        where: { id: teamId },
        select: { applyBlocked: true },
      });
      applyBlocked = Boolean(active?.applyBlocked);
    }
  }
  const comp = await prisma.competitionProfile.findUnique({ where: { id }, include: { applicationPacket: { select: { filename: true } } } });
  if (!comp || !isCompetitionVisibleToTeams(comp)) notFound();

  const open = isCompetitionOpen(comp);
  const fields: Array<[string, ReactNode]> = [
    ["Dates", comp.dates],
    ["Location", comp.location],
    ["Venue", comp.venue],
    ["Venue address", comp.venueAddress],
    ["Stage", comp.stageSize],
    ["AV guidelines", comp.lighting],
    ["Production", comp.productionNotes],
  ];

  return (
    <PageShell>
    <article className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Competition</p>
        <h1 className="font-heading text-4xl">{comp.name}</h1>
        <div className="mt-2"><CompetitionTypeBadge isPartner={comp.isPartner} isAffiliate={comp.isAffiliate} /></div>
        <p className="mt-2 text-sm">
          {open ? (
            <span className="font-medium text-accent">Accepting applications</span>
          ) : (
            <span className="text-muted">Not accepting applications</span>
          )}
        </p>
      </div>
      {comp.description ? <section className="max-w-2xl"><h2 className="font-heading text-2xl">About the competition</h2><p className="mt-2 whitespace-pre-wrap text-muted">{comp.description}</p></section> : null}
      <dl className="grid gap-4 rounded-xl border border-line bg-card p-6 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap">{value || "TBA"}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-3 rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-2xl">Application periods</h2>
        <ApplicationPeriodSummary schedule={{
          earlyDeadline: comp.earlyTierDeadline,
          regularDeadline: comp.earlyApplicationDeadline,
          lateDeadline: comp.applicationDeadline,
          finalCutoff: comp.applicationClosesAt,
          earlyFeeCents: comp.earlyApplicationFeeCents,
          regularFeeCents: comp.regularApplicationFeeCents,
          lateFeeCents: comp.lateApplicationFeeCents,
        }} />
      </section>
      <section className="space-y-3 rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-2xl">Payment instructions</h2>
        <p className="whitespace-pre-wrap break-words">{comp.paymentInstructions || "The host has not provided payment instructions yet. Contact the competition before sending payment."}</p>
        <p className="text-sm text-muted">These are the host’s application fees. Payments are handled outside OneLegends. Any separate circuit fees are listed on the <Link className="text-accent underline" href="/payments">circuit payments page</Link>.</p>
      </section>
      {comp.applicationPacketDriveUrl || (comp.applicationPacket && !comp.applicationPacketLegacyHidden) ? (
        <section className="space-y-3 rounded-xl border border-line bg-card p-6">
          <h2 className="font-heading text-2xl">Application packet</h2>
          {comp.applicationPacketDriveUrl ? (
            <a className="btn btn-ghost" href={comp.applicationPacketDriveUrl} target="_blank" rel="noopener noreferrer">Open application packet on Google Drive</a>
          ) : (
            <>
              <a className="btn btn-ghost" href={`/api/competitions/${comp.id}/packet`}>Download application packet (PDF)</a>
              <p className="break-words text-sm text-muted">{comp.applicationPacket?.filename}</p>
            </>
          )}
        </section>
      ) : null}
      {applyBlocked ? (
        <p className="notice notice-error">{TEAM_APPLY_OPS_BLOCKED_MESSAGE}</p>
      ) : canApply && open ? (
        <Link href="/team/apply" className="btn btn-primary">
          Apply from your profile
        </Link>
      ) : null}
    </article>
    </PageShell>
  );
}
