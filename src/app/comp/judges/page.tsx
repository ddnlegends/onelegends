import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JudgeDecisionButtons } from "@/components/JudgeDecisionButtons";
import { FinalizeResultsForm, RemoveJudgeForm } from "@/components/JudgePanelControls";
import { formatDateTime } from "@/lib/utils";
import { getActiveCompetitionId, isPlatformAdmin } from "@/lib/team-access";
import { InviteJudgeForm, CancelJudgeInviteForm } from "@/components/AccountForms";
import { isScoreComplete } from "@/lib/judging";

export default async function CompJudgesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const competitionId = await getActiveCompetitionId(session.user.id);
  if (!competitionId) return null;
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      applications: { select: { viewingPosition: true }, take: 1 },
      judgeInvites: { orderBy: { createdAt: "desc" } },
      judgeAssignments: {
        include: {
          judge: { include: { user: { select: { email: true } } } },
          slots: { include: { score: true } },
        },
        orderBy: { requestedAt: "desc" },
      },
    },
  });
  if (!competition) return null;

  const pending = competition.judgeAssignments.filter((a) => a.status === "PENDING");
  const approved = competition.judgeAssignments.filter((a) => a.status === "APPROVED");
  const denied = competition.judgeAssignments.filter((a) => a.status === "DENIED");
  const removed = competition.judgeAssignments.filter((a) => a.status === "REMOVED");
  const completed = approved.filter((a) => a.submittedAt).length;
  const released = Boolean(competition.resultsReleasedAt);
  const started = competition.applications.some((app) => app.viewingPosition != null);
  const techAdmin = await isPlatformAdmin(session.user.id);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-4xl">Judges</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Invite judges by email. This app does not send mail — they approve
            the invite the next time they log in. Every approved judge counts
            toward the active panel. Finalize results after all have submitted.
          </p>
        </div>
        <Link href="/comp/results" className="btn btn-primary">
          Viewing Results
        </Link>
      </div>

      {!released ? <InviteJudgeForm competitionId={competition.id} /> : null}

      <FinalizeResultsForm
        competitionId={competition.id}
        approved={approved.length}
        submitted={completed}
        pending={pending.length + competition.judgeInvites.length}
        released={released}
      />

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Pending</h2>
        {competition.judgeInvites.length === 0 && pending.length === 0 ? (
          <p className="text-sm text-muted">No requests waiting.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {competition.judgeInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-sm text-muted">
                    Waiting to approve the next time they log in
                  </p>
                </div>
                {!released ? <CancelJudgeInviteForm inviteId={invite.id} /> : null}
              </li>
            ))}
            {pending.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{row.judge.name}</p>
                  <p className="text-sm text-muted">
                    {row.judge.user.email}
                    {row.judge.phone ? ` · ${row.judge.phone}` : ""}
                    {" · "}
                    Requested {formatDateTime(row.requestedAt)}
                  </p>
                </div>
                {!released ? <JudgeDecisionButtons assignmentId={row.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Approved</h2>
        {approved.length === 0 ? (
          <p className="text-sm text-muted">No judges approved yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {approved.map((row) => {
              const scored = row.slots.filter((s) => isScoreComplete(s.score)).length;
              const total = row.slots.length;
              return (
                <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{row.judge.name}</p>
                    <p className="text-sm text-muted">
                      {row.judge.user.email}
                      {row.judge.phone ? ` · ${row.judge.phone}` : ""}
                      {row.decidedAt ? ` · Approved ${formatDateTime(row.decidedAt)}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {row.submittedAt
                        ? `Submitted ${formatDateTime(row.submittedAt)}`
                        : total ? `In progress · ${scored} / ${total} teams scored` : "Approved · packet not opened yet"}
                    </p>
                  </div>
                  {!released && (!started || techAdmin) ? (
                    <RemoveJudgeForm assignmentId={row.id} name={row.judge.name} email={row.judge.user.email} scored={scored} total={total} submitted={Boolean(row.submittedAt)} live={started} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {denied.length ? (
        <section className="space-y-3">
          <h2 className="font-heading text-2xl">Denied</h2>
          <ul className="text-sm text-muted">
            {denied.map((row) => (
              <li key={row.id}>
                {row.judge.name} · {row.judge.user.email}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {removed.length ? (
        <section className="space-y-3">
          <h2 className="font-heading text-2xl">Removed</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
            {removed.map((row) => (
              <li key={row.id} className="px-4 py-3">
                {row.judge.name} · {row.judge.user.email}
                <span className="text-muted"> · {row.removedAt ? formatDateTime(row.removedAt) : "Removed"} by {row.removedByEmail || "admin"} · {row.removalReason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
