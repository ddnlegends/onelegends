import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CompStatusPill } from "@/components/CompStatusPill";
import { JudgingControls } from "@/components/JudgingControls";
import { FinalizeResultsForm, RemoveJudgeForm } from "@/components/JudgePanelControls";
import { LiveProgress } from "@/components/LiveProgress";
import {
  RUBRIC_CATEGORIES,
  competitionStatus,
  ensureSharedViewingOrder,
  isCompetitionClaimed,
  isCompetitionOpen,
  isJudgingOpen,
  isScoreComplete,
  rubricCell,
  rubricFilledCount,
  rubricTotalOrNull,
  scoreComment,
} from "@/lib/judging";
import { rankTeams } from "@/lib/results";
import { formatDateTime } from "@/lib/utils";
import { isPlatformAdmin } from "@/lib/team-access";
import { judgePanelCompletion } from "@/lib/judge-panel-completion";

export default async function CompDashboardDetailPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await isPlatformAdmin(session.user.id))) redirect("/dashboard");

  const base = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
  });
  if (!base) notFound();
  if (isJudgingOpen(base)) await ensureSharedViewingOrder(competitionId);

  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      applications: {
        select: {
          id: true,
          teamId: true,
          status: true,
          viewingPosition: true,
          team: { select: { name: true } },
        },
      },
      judgeAssignments: {
        where: { status: { in: ["APPROVED", "PENDING", "REMOVED"] } },
        include: {
          judge: { select: { name: true, user: { select: { email: true } } } },
          slots: {
            select: {
              applicationId: true,
              position: true,
              score: true,
            },
          },
        },
        orderBy: { judge: { name: "asc" } },
      },
      judgeInvites: { orderBy: { createdAt: "asc" } },
      moderatorAccess: {
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: "asc" },
      },
      memberships: {
        where: { status: "APPROVED", isAdmin: true },
        include: { user: { select: { email: true } } },
      },
      moderatorInvites: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!competition) notFound();

  const status = competitionStatus(competition);
  const claimed = isCompetitionClaimed(competition);
  const appsOpen = isCompetitionOpen(competition);
  const released = Boolean(competition.resultsReleasedAt);
  const live = status === "LIVE";
  const livePosition = live ? competition.livePosition : null;
  const moderatorEmails = new Set(competition.moderatorAccess.map((row) => row.user.email));
  if (!competition.isPartner) {
    for (const membership of competition.memberships) moderatorEmails.add(membership.user.email);
  }

  const ordered = competition.applications
    .filter((app) => app.viewingPosition != null)
    .sort((a, b) => (a.viewingPosition as number) - (b.viewingPosition as number));
  const hasOrder = ordered.length > 0;
  const approved = competition.judgeAssignments.filter(
    (row) => row.status === "APPROVED",
  );
  const pendingJudges = competition.judgeAssignments.filter(
    (row) => row.status === "PENDING",
  );
  const removedJudges = competition.judgeAssignments.filter((row) => row.status === "REMOVED");
  const submitted = approved.filter((row) => row.submittedAt);
  const closeProgress = judgePanelCompletion(competition.applications, approved);

  const scoreFor = (
    judge: (typeof approved)[number],
    applicationId: string,
  ) => judge.slots.find((slot) => slot.applicationId === applicationId)?.score ?? null;

  const ranked = released ? rankTeams(competition.applications, submitted) : [];

  return (
    <div className="space-y-8">
      <AutoRefresh active={status === "LIVE" || status === "READY"} intervalMs={4000} />

      <div className="space-y-3">
        <Link href="/ops/comps" className="text-sm text-muted underline">
          Comp Dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-4xl">{competition.name}</h1>
          <CompStatusPill status={status} />
          <Link
            href={`/ops/export?competitionId=${competition.id}`}
            className="btn btn-ghost ml-auto py-1.5 text-sm"
          >
            Export
          </Link>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          {released
            ? "Judging is complete. Team names are unsealed below."
            : "Teams stay as Team 1, Team 2, … until results release. No videos play here; the moderator runs them."}
        </p>
      </div>

      {hasOrder && (status === "LIVE" || status === "READY") ? (
        <section className="rounded-2xl border border-accent-ember/30 bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">
                {live ? "On screen now" : "Waiting for moderator"}
              </p>
              <p className="font-heading text-5xl text-accent">
                {livePosition != null ? `Team ${livePosition}` : "—"}
              </p>
              {competition.liveUpdatedAt && live ? (
                <p className="mt-1 text-xs text-muted">
                  Switched {formatDateTime(competition.liveUpdatedAt)}
                </p>
              ) : null}
            </div>
            <div className="w-full max-w-md">
              <LiveProgress current={livePosition} total={ordered.length} />
            </div>
          </div>
          {livePosition != null ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {approved.map((judge) => {
                const app = ordered.find((row) => row.viewingPosition === livePosition);
                const score = app ? scoreFor(judge, app.id) : null;
                const filled = rubricFilledCount(score);
                const done = isScoreComplete(score);
                return (
                  <span
                    key={judge.id}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                      done
                        ? "border-success-line bg-success-soft text-success"
                        : filled
                          ? "border-warning-line bg-warning-soft text-warning"
                          : "border-line bg-blush text-muted"
                    }`}
                  >
                    <span className="font-semibold">{judge.judge.name}</span>
                    {done ? "Scored" : filled ? `${filled}/5` : "Not started"}
                  </span>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Teams" value={String(competition.applications.length)} />
        <Stat
          label="Judges"
          value={String(approved.length)}
          hint={
            pendingJudges.length + competition.judgeInvites.length
              ? `${pendingJudges.length + competition.judgeInvites.length} invited, not accepted`
              : undefined
          }
        />
        <Stat
          label="Packets in"
          value={`${submitted.length} / ${approved.length}`}
          hint={released ? "Results released" : "Active judges submitted"}
        />
        <Stat
          label="Moderator"
          value={String(moderatorEmails.size)}
          hint={
            moderatorEmails.size
              ? [...moderatorEmails].join(", ")
              : competition.moderatorInvites.length
                ? `${competition.moderatorInvites.length} waiting to log in`
                : "Grant one on circuit ops home"
          }
        />
      </div>

      <JudgingControls
        competitionId={competition.id}
        judgingOpen={competition.judgingOpen}
        appsOpen={appsOpen}
        claimed={claimed}
        released={released}
        closeProgress={closeProgress}
      />

      <FinalizeResultsForm
        competitionId={competition.id}
        approved={approved.length}
        submitted={submitted.length}
        pending={pendingJudges.length + competition.judgeInvites.length}
        released={released}
      />

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Active judge panel</h2>
        {approved.length === 0 ? <p className="text-sm text-muted">No approved judges.</p> : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {approved.map((judge) => (
              <li key={judge.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{judge.judge.name} · {judge.judge.user.email}</p>
                  <p className="text-sm text-muted">{judge.slots.filter((slot) => isScoreComplete(slot.score)).length} / {ordered.length} scored · {judge.submittedAt ? "Submitted" : "Scoring"}</p>
                </div>
                {!released ? <RemoveJudgeForm assignmentId={judge.id} name={judge.judge.name} email={judge.judge.user.email} scored={judge.slots.filter((slot) => isScoreComplete(slot.score)).length} total={ordered.length} submitted={Boolean(judge.submittedAt)} live={hasOrder} /> : null}
              </li>
            ))}
          </ul>
        )}
        {removedJudges.length ? (
          <ul className="text-sm text-muted">
            {removedJudges.map((judge) => <li key={judge.id}>{judge.judge.name} · {judge.judge.user.email} · removed by {judge.removedByEmail || "admin"}: {judge.removalReason}</li>)}
          </ul>
        ) : null}
      </section>

      {released ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-heading text-2xl">Final summary</h2>
            {competition.resultsReleasedAt ? (
              <p className="text-sm text-muted">
                Released {formatDateTime(competition.resultsReleasedAt)}
              </p>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Viewed as</th>
                  <th className="px-4 py-3 font-medium">Avg total</th>
                  <th className="px-4 py-3 font-medium">Avg z-score</th>
                  <th className="px-4 py-3 font-medium">Judges</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, index) => (
                  <tr key={row.applicationId} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-heading text-lg text-accent">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3 text-muted">
                      {row.viewingPosition != null ? `Team ${row.viewingPosition}` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.judges.length ? `${row.avgTotal.toFixed(1)} / 50` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.judges.length ? row.avgZ.toFixed(3) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.judges.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            Rank is each judge’s z-score averaged per team, then average total.
            Only submitted packets count.
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-2xl">Scores by team</h2>
          <p className="text-sm text-muted">Totals out of 50 · refreshes live</p>
        </div>
        {!hasOrder ? (
          <p className="rounded-xl border border-line bg-blush px-4 py-3 text-sm text-muted">
            Team numbers are assigned when judging opens.
          </p>
        ) : approved.length === 0 ? (
          <p className="rounded-xl border border-line bg-blush px-4 py-3 text-sm text-muted">
            No judges have accepted yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="sticky left-0 bg-blush px-4 py-3 font-medium">Team</th>
                  {approved.map((judge) => (
                    <th key={judge.id} className="px-3 py-3 font-medium">
                      <span className="block normal-case tracking-normal text-ink">
                        {judge.judge.name}
                      </span>
                      <span className="text-[0.65rem]">
                        {judge.submittedAt ? "Submitted" : "Scoring"}
                      </span>
                    </th>
                  ))}
                  {released ? <th className="px-3 py-3 font-medium">Avg</th> : null}
                </tr>
              </thead>
              <tbody>
                {ordered.map((app) => {
                  const isLive = app.viewingPosition === livePosition;
                  const totals = approved
                    .map((judge) => rubricTotalOrNull(scoreFor(judge, app.id)))
                    .filter((n): n is number => n != null);
                  const avg = totals.length
                    ? totals.reduce((sum, n) => sum + n, 0) / totals.length
                    : null;
                  return (
                    <tr
                      key={app.id}
                      className={`border-b border-line last:border-0 ${
                        isLive ? "bg-accent-ember/5" : ""
                      }`}
                    >
                      <th
                        className={`sticky left-0 px-4 py-3 text-left font-semibold ${
                          isLive ? "bg-live-surface" : "bg-card"
                        }`}
                      >
                        Team {app.viewingPosition}
                        {released ? (
                          <span className="block text-xs font-normal text-muted">
                            {app.team.name}
                          </span>
                        ) : null}
                        {isLive ? (
                          <span className="ml-2 rounded-full bg-brand-ember px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white">
                            Live
                          </span>
                        ) : null}
                      </th>
                      {approved.map((judge) => {
                        const score = scoreFor(judge, app.id);
                        const total = rubricTotalOrNull(score);
                        const filled = rubricFilledCount(score);
                        return (
                          <td key={judge.id} className="px-3 py-3 tabular-nums">
                            {total != null ? (
                              <span className="font-semibold">{total}</span>
                            ) : filled ? (
                              <span className="text-warning">{filled}/5</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        );
                      })}
                      {released ? <td className="px-3 py-3 font-semibold tabular-nums text-accent">{avg != null ? avg.toFixed(1) : "—"}</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {hasOrder && approved.length ? (
        <section className="space-y-3">
          <h2 className="font-heading text-2xl">Each judge’s sheet</h2>
          <div className="space-y-3">
            {approved.map((judge) => {
              const complete = ordered.filter((app) =>
                isScoreComplete(scoreFor(judge, app.id)),
              ).length;
              return (
                <details
                  key={judge.id}
                  className="group rounded-xl border border-line bg-card"
                  open={live}
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-semibold">{judge.judge.name}</p>
                      <p className="text-xs text-muted">{judge.judge.user.email}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="tabular-nums text-muted">
                        {complete} / {ordered.length} scored
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          judge.submittedAt
                            ? "bg-success-soft text-success"
                            : "bg-blush text-muted"
                        }`}
                      >
                        {judge.submittedAt ? "Submitted" : "In progress"}
                      </span>
                      <span className="text-muted transition group-open:rotate-180">▾</span>
                    </div>
                  </summary>
                  <div className="overflow-x-auto border-t border-line">
                    <table className="w-full min-w-[44rem] text-left text-sm">
                      <thead className="bg-blush text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-4 py-2 font-medium">Team</th>
                          {RUBRIC_CATEGORIES.map((category) => (
                            <th key={category.key} className="px-3 py-2 font-medium">
                              {category.label}
                            </th>
                          ))}
                          <th className="px-3 py-2 font-medium">Total</th>
                          <th className="px-3 py-2 font-medium">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordered.map((app) => {
                          const score = scoreFor(judge, app.id);
                          const total = rubricTotalOrNull(score);
                          const isLive = app.viewingPosition === livePosition;
                          return (
                            <tr
                              key={app.id}
                              className={`border-t border-line ${isLive ? "bg-accent-ember/5" : ""}`}
                            >
                              <th className="px-4 py-2 text-left font-semibold">
                                Team {app.viewingPosition}
                              </th>
                              {RUBRIC_CATEGORIES.map((category) => (
                                <td key={category.key} className="px-3 py-2 tabular-nums">
                                  {rubricCell(score?.[category.key])}
                                </td>
                              ))}
                              <td className="px-3 py-2 font-semibold tabular-nums">
                                {total ?? "—"}
                              </td>
                              <td className="max-w-[14rem] px-3 py-2 text-xs text-muted">
                                {scoreComment(score) || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      ) : null}

      {pendingJudges.length || competition.judgeInvites.length ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Invited, not accepted
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
            {competition.judgeInvites.map((invite) => (
              <li key={invite.id} className="px-4 py-2">
                {invite.email}
                <span className="text-muted"> · waiting to log in</span>
              </li>
            ))}
            {pendingJudges.map((row) => (
              <li key={row.id} className="px-4 py-2">
                {row.judge.name}
                <span className="text-muted"> · {row.judge.user.email} · pending</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-heading text-3xl tabular-nums text-accent">{value}</p>
      {hint ? <p className="mt-1 truncate text-xs text-muted" title={hint}>{hint}</p> : null}
    </div>
  );
}
