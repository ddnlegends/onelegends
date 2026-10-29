import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveTeamId } from "@/lib/team-access";
import { applicationPhaseLabel } from "@/lib/application-schedule";
import { formatApplicationFee } from "@/lib/competition-details";
import { teamVisibleApplicationStatus } from "@/lib/application-decisions";
import { statusLabel } from "@/lib/utils";
import { submittedApplicationAvUrl } from "@/lib/application-av";
import { LocalDateTime } from "@/components/LocalDateTime";
import { DriveAvPlayer } from "@/components/DriveAvPlayer";
import { TeamDetails } from "@/components/TeamDetails";

export default async function TeamApplicationReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const teamId = await getActiveTeamId(session.user.id);
  if (!teamId) notFound();

  const { applicationId } = await params;
  const application = await prisma.application.findFirst({
    where: { id: applicationId, teamId },
    include: {
      competition: { select: { id: true, name: true, decisionsSubmittedAt: true } },
      team: { include: { dancers: { orderBy: { name: "asc" } } } },
    },
  });
  if (!application) notFound();

  const status = application.removedAt
    ? application.removalReason === "Withdrawn by team" ? "Withdrawn" : "Removed"
    : statusLabel(teamVisibleApplicationStatus(application.status, application.competition.decisionsSubmittedAt));

  return (
    <div className="space-y-7">
      <Link href="/team" className="text-sm underline">← Your applications</Link>
      <div>
        <h1 className="font-heading text-4xl">Review application</h1>
        <p className="mt-2 text-muted">{application.competition.name} · {application.team.name}</p>
      </div>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-heading text-2xl">Application record</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Applied</dt><dd><LocalDateTime date={application.createdAt} /></dd></div>
          <div><dt className="text-muted">Status</dt><dd>{status}</dd></div>
          <div><dt className="text-muted">Application phase</dt><dd>{applicationPhaseLabel(application.appliedPhase)}</dd></div>
          <div><dt className="text-muted">Expected host fee</dt><dd>{formatApplicationFee(application.expectedFeeCents)}</dd></div>
        </dl>
        <Link href={`/comps/${application.competition.id}`} className="mt-4 inline-block text-sm text-accent underline">Competition details and packet</Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">AV link for this application</h2>
        <p className="text-sm text-muted">
          {application.submittedAvDriveUrl
            ? application.removedAt
              ? "This application is no longer active. This is the AV link saved when you applied."
              : "This AV link was saved when you applied and stays fixed for this competition. Editing your team profile does not change it. To change this application’s AV link, withdraw and reapply while applications are open and withdrawal is available. Your new application uses the current phase and fee."
            : "This earlier application did not save a separate AV link, so it uses your current profile AV link."}
        </p>
        <DriveAvPlayer url={submittedApplicationAvUrl(application)} label={`${application.team.name} application AV`} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl">Current team profile and roster</h2>
            <p className="mt-1 text-sm text-muted">These details stay current when you edit your profile. They are not a snapshot from when you applied.</p>
          </div>
          <Link href="/team/profile" className="text-sm text-accent underline">Edit team profile</Link>
        </div>
        <TeamDetails team={application.team} hideHeading hideAv />
      </section>
    </div>
  );
}
