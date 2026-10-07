import { PageShell } from "@/components/PageShell";
import { CompetitionTypeBadge } from "@/components/CompetitionTypeBadge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isCompetitionOpen } from "@/lib/judging";
import { formatDateTime } from "@/lib/utils";
import { getActiveTeamId, userHasTeamAccess } from "@/lib/team-access";
import { TEAM_APPLY_OPS_BLOCKED_MESSAGE } from "@/lib/team-profile";

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
  const comp = await prisma.competitionProfile.findUnique({ where: { id } });
  if (!comp) notFound();

  const open = isCompetitionOpen(comp);
  const fields = [
    ["Dates", comp.dates],
    ["Location", comp.location],
    ["Venue", comp.venue],
    ["Stage", comp.stageSize],
    ["Lighting", comp.lighting],
    ["Production", comp.productionNotes],
    [
      "Application deadline",
      comp.applicationDeadline
        ? formatDateTime(comp.applicationDeadline)
        : "No clock deadline",
    ],
  ];

  return (
    <PageShell>
    <article className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Competition</p>
        <h1 className="font-heading text-4xl">{comp.name}</h1>
        <div className="mt-2"><CompetitionTypeBadge isPartner={comp.isPartner} /></div>
        <p className="mt-2 text-sm">
          {open ? (
            <span className="font-medium text-accent">Accepting applications</span>
          ) : (
            <span className="text-muted">Not accepting applications</span>
          )}
        </p>
      </div>
      {comp.description ? <p className="max-w-2xl text-muted">{comp.description}</p> : null}
      <dl className="grid gap-4 rounded-xl border border-line bg-card p-6 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap">{value || "TBA"}</dd>
          </div>
        ))}
      </dl>
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
