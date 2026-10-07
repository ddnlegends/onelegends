import Link from "next/link";
import { requirePlatformAdminPage } from "@/lib/page-guards";
import {
  CancelCompInviteForm,
  CompetitionTypeForm,
  InviteCompAdminForm,
  ResetCompClaimForm,
  RevokeCompAccessForm,
} from "@/components/AccountForms";
import { CompStatusPill } from "@/components/CompStatusPill";
import { CompetitionTypeBadge } from "@/components/CompetitionTypeBadge";
import { ExpandableRow } from "@/components/ExpandableRow";
import { Chip, ExternalLink, InfoGrid, PanelSection } from "@/components/OpsListParts";
import { prisma } from "@/lib/prisma";
import { competitionStatus } from "@/lib/judging";
import { formatDate, formatDateTime, statusLabel } from "@/lib/utils";

const JUDGE_STATUS: Record<string, string> = {
  APPROVED: "Approved",
  PENDING: "Waiting to approve",
  DENIED: "Denied",
};

export default async function OpsCompetitionsPage() {
  const { id: userId } = await requirePlatformAdminPage();
  const competitions = await prisma.competitionProfile.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: { orderBy: { createdAt: "desc" } },
      applications: {
        include: { team: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      judgeAssignments: {
        include: {
          judge: { select: { name: true, phone: true, user: { select: { email: true } } } },
        },
        orderBy: { requestedAt: "asc" },
      },
      judgeInvites: { orderBy: { createdAt: "asc" } },
      moderatorAccess: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      moderatorInvites: { orderBy: { createdAt: "asc" } },
    },
  });
  const claimed = competitions.filter((comp) => comp.claimedAt || comp.userId).length;
  const released = competitions.filter((comp) => comp.resultsReleasedAt).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Competitions</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Every competition listing. Open one with its arrow to see all of its
          event and production details, admins, moderator access, judges, and
          applications. Live judging stays on the Comp Dashboard.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Competitions", value: competitions.length },
          { label: "Claimed", value: claimed },
          { label: "Results released", value: released },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-card px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
            <p className="font-heading text-3xl tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {competitions.length === 0 ? (
        <p className="text-muted">No competitions yet. Create one from Circuit ops.</p>
      ) : (
        <div className="space-y-3">
          {competitions.map((competition) => {
            const status = competitionStatus(competition);
            const approved = competition.memberships.filter((m) => m.status === "APPROVED");
            const pending = competition.memberships.filter((m) => m.status === "PENDING");
            const approvedJudges = competition.judgeAssignments.filter(
              (assignment) => assignment.status === "APPROVED",
            );
            const packets = approvedJudges.filter((assignment) => assignment.submittedAt).length;
            const accepted = competition.applications.filter(
              (application) => application.status === "ACCEPTED",
            ).length;

            return (
              <ExpandableRow
                key={competition.id}
                summary={
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-heading text-xl">{competition.name}</span>
                      <CompetitionTypeBadge isPartner={competition.isPartner} />
                      <CompStatusPill status={status} />
                      {pending.length || competition.invites.length ? (
                        <Chip tone="warn">
                          {pending.length + competition.invites.length} pending
                        </Chip>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-muted">
                      {[
                        competition.dates || null,
                        competition.location || null,
                        `${competition.applications.length} application${competition.applications.length === 1 ? "" : "s"}`,
                        `${packets} / ${competition.requiredJudgeCount} packets`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Claim code
                    </p>
                    <p className="font-mono text-lg text-accent">{competition.claimCode}</p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <Link
                      href={`/ops/comps/${competition.id}`}
                      prefetch={false}
                      className="btn btn-ghost py-1.5"
                    >
                      Live dashboard
                    </Link>
                    <Link
                      href={`/ops/export?competitionId=${competition.id}`}
                      prefetch={false}
                      className="btn btn-ghost py-1.5"
                    >
                      Export
                    </Link>
                    {competition.claimedAt ? (
                      <ResetCompClaimForm
                        competitionId={competition.id}
                        competitionName={competition.name}
                      />
                    ) : null}
                  </div>
                </div>

                <PanelSection title="Event details">
                  <CompetitionTypeForm
                    competitionId={competition.id}
                    isPartner={competition.isPartner}
                  />
                  <InfoGrid
                    items={[
                      { label: "Event dates", value: competition.dates },
                      { label: "Event date", value: competition.eventDate ? formatDate(competition.eventDate) : "" },
                      { label: "Location (city)", value: competition.location },
                      { label: "Venue", value: competition.venue },
                      { label: "Comp details", value: competition.description, wide: true },
                    ]}
                  />
                </PanelSection>

                <PanelSection title="Production">
                  <InfoGrid
                    items={[
                      { label: "Stage size / dimensions", value: competition.stageSize },
                      { label: "Lighting", value: competition.lighting },
                      { label: "Production notes", value: competition.productionNotes, wide: true },
                    ]}
                  />
                </PanelSection>

                <PanelSection title="Applications and judging">
                  <InfoGrid
                    items={[
                      { label: "Accepting applications", value: competition.acceptingApps ? "Yes" : "No" },
                      {
                        label: "Application deadline",
                        value: competition.applicationDeadline
                          ? formatDateTime(competition.applicationDeadline)
                          : "No deadline",
                      },
                      {
                        label: "Applications",
                        value: `${competition.applications.length} total · ${accepted} accepted`,
                      },
                      { label: "Required judges (N)", value: competition.requiredJudgeCount },
                      { label: "Judging open", value: competition.judgingOpen ? "Yes" : "No" },
                      {
                        label: "Packets submitted",
                        value: `${packets} of ${approvedJudges.length} approved judge${approvedJudges.length === 1 ? "" : "s"}`,
                      },
                      {
                        label: "Results released",
                        value: competition.resultsReleasedAt
                          ? formatDateTime(competition.resultsReleasedAt)
                          : "Not yet",
                      },
                      {
                        label: "Applicant Google Sheet",
                        value: competition.googleSheetUrl ? (
                          <ExternalLink href={competition.googleSheetUrl}>Open sheet</ExternalLink>
                        ) : (
                          ""
                        ),
                      },
                      {
                        label: "Listing",
                        value: `Created ${formatDate(competition.createdAt)}${competition.claimedAt ? ` · claimed ${formatDate(competition.claimedAt)}` : " · unclaimed"}`,
                      },
                    ]}
                  />
                </PanelSection>

                <PanelSection title="Owners and admins">
                  {approved.length === 0 ? (
                    <p className="text-sm text-muted">No owner has claimed this competition yet.</p>
                  ) : (
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {approved.map((membership) => (
                        <li
                          key={membership.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span className="text-sm">
                            {membership.user.name ? `${membership.user.name} · ` : ""}
                            {membership.user.email}
                            <span className="text-muted">
                              {membership.isPrimary ? " · Primary" : " · Secondary"}
                            </span>
                          </span>
                          {!membership.isPrimary && membership.userId !== userId ? (
                            <RevokeCompAccessForm membershipId={membership.id} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {competition.claimedAt ? (
                    <InviteCompAdminForm competitionId={competition.id} />
                  ) : null}
                </PanelSection>

                {competition.invites.length || pending.length ? (
                  <PanelSection title="Requests sent">
                    <ul className="divide-y divide-line rounded-lg border border-line">
                      {competition.invites.map((invite) => (
                        <li
                          key={invite.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span className="text-sm">
                            {invite.email}
                            <span className="text-muted"> · waiting to create an account</span>
                          </span>
                          <CancelCompInviteForm inviteId={invite.id} />
                        </li>
                      ))}
                      {pending.map((membership) => (
                        <li
                          key={membership.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span className="text-sm">
                            {membership.user.email}
                            <span className="text-muted"> · waiting to approve</span>
                          </span>
                          <RevokeCompAccessForm membershipId={membership.id} />
                        </li>
                      ))}
                    </ul>
                  </PanelSection>
                ) : null}

                <PanelSection title="Moderator access">
                  {competition.moderatorAccess.length || competition.moderatorInvites.length ? (
                    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                      {competition.moderatorAccess.map((row) => (
                        <li key={row.id} className="px-3 py-2">
                          {row.user.name ? `${row.user.name} · ` : ""}
                          {row.user.email}
                        </li>
                      ))}
                      {competition.moderatorInvites.map((invite) => (
                        <li key={invite.id} className="px-3 py-2">
                          {invite.email}
                          <span className="text-muted"> · waiting to log in</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">
                      No moderator assigned. Grant access from Circuit ops.
                    </p>
                  )}
                </PanelSection>

                <PanelSection title="Judges">
                  {competition.judgeAssignments.length || competition.judgeInvites.length ? (
                    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                      {competition.judgeAssignments.map((assignment) => (
                        <li
                          key={assignment.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span>
                            {assignment.judge.name || assignment.judge.user.email}
                            <span className="text-muted">
                              {" · "}
                              {assignment.judge.user.email}
                              {assignment.judge.phone ? ` · ${assignment.judge.phone}` : ""}
                            </span>
                          </span>
                          <span className="text-muted">
                            {JUDGE_STATUS[assignment.status] ?? assignment.status}
                            {assignment.submittedAt
                              ? ` · packet submitted ${formatDateTime(assignment.submittedAt)}`
                              : assignment.status === "APPROVED"
                                ? " · packet not submitted"
                                : ""}
                          </span>
                        </li>
                      ))}
                      {competition.judgeInvites.map((invite) => (
                        <li
                          key={invite.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span>{invite.email}</span>
                          <span className="text-muted">Invited · no account yet</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">No judges yet.</p>
                  )}
                </PanelSection>

                <PanelSection title="Applications">
                  {competition.applications.length === 0 ? (
                    <p className="text-sm text-muted">No applications yet.</p>
                  ) : (
                    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                      {competition.applications.map((application) => (
                        <li
                          key={application.id}
                          className="flex flex-wrap justify-between gap-3 px-3 py-2"
                        >
                          <Link
                            href={`/ops/teams/${application.team.id}`}
                            prefetch={false}
                            className="hover:text-accent hover:underline"
                          >
                            {application.team.name}
                          </Link>
                          <span className="text-muted">
                            {statusLabel(application.status)} · applied{" "}
                            {formatDate(application.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelSection>
              </ExpandableRow>
            );
          })}
        </div>
      )}
    </div>
  );
}
