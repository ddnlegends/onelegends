import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CompStatusPill } from "@/components/CompStatusPill";
import { CompetitionTypeBadge } from "@/components/CompetitionTypeBadge";
import { LiveProgress } from "@/components/LiveProgress";
import {
  COMP_STATUS_LABEL,
  competitionStatus,
  type CompStatus,
} from "@/lib/judging";
import { formatDate, formatDateTime } from "@/lib/utils";
import { isPlatformAdmin } from "@/lib/team-access";

const STATUS_ORDER: CompStatus[] = [
  "LIVE",
  "READY",
  "APPS_CLOSED",
  "APPS_OPEN",
  "COMPLETE",
  "UNCLAIMED",
];

export default async function CompDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await isPlatformAdmin(session.user.id))) redirect("/dashboard");

  const comps = await prisma.competitionProfile.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isPartner: true,
      location: true,
      eventDate: true,
      acceptingApps: true,
      earlyApplicationDeadline: true,
      applicationDeadline: true,
      claimedAt: true,
      userId: true,
      judgingOpen: true,
      livePosition: true,
      liveUpdatedAt: true,
      resultsReleasedAt: true,
      requiredJudgeCount: true,
      _count: {
        select: { applications: true, moderatorAccess: true },
      },
      judgeAssignments: {
        where: { status: "APPROVED" },
        select: { submittedAt: true },
      },
    },
  });

  const rows = comps
    .map((comp) => ({ ...comp, status: competitionStatus(comp) }))
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        a.name.localeCompare(b.name),
    );
  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: rows.filter((row) => row.status === status).length,
  }));
  const anyLive = rows.some((row) => row.status === "LIVE" || row.status === "READY");

  return (
    <div className="space-y-8">
      <AutoRefresh active={anyLive} intervalMs={5000} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            Circuit ops only
          </p>
          <h1 className="font-heading text-4xl">Comp Dashboard</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every competition in the system. Live boxes show the team the moderator has
            on screen. Open a box for each judge’s scores by Team number.
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-ghost">
          Circuit ops home
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map(({ status, count }) => (
          <div
            key={status}
            className={`rounded-xl border px-4 py-3 ${
              status === "LIVE" && count > 0
                ? "border-accent-ember/40 bg-accent-ember/5"
                : "border-line bg-card"
            }`}
          >
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
              {COMP_STATUS_LABEL[status]}
            </p>
            <p
              className={`mt-1 font-heading text-2xl tabular-nums ${
                status === "LIVE" && count > 0 ? "text-accent-ember" : "text-ink"
              }`}
            >
              {count}
            </p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted">No competitions yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((comp) => {
            const packetsIn = comp.judgeAssignments.filter(
              (row) => row.submittedAt,
            ).length;
            const judges = comp.judgeAssignments.length;
            const teams = comp._count.applications;
            const live = comp.status === "LIVE";
            return (
              <li key={comp.id}>
                <Link
                  href={`/ops/comps/${comp.id}`}
                  className={`group flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
                    live
                      ? "border-accent-ember/50 shadow-sm ring-1 ring-accent-ember/20"
                      : "border-line hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-heading text-xl group-hover:text-accent">
                        {comp.name}
                      </h2>
                      <CompetitionTypeBadge isPartner={comp.isPartner} />
                      <p className="truncate text-xs text-muted">
                        {[comp.location, comp.eventDate ? formatDate(comp.eventDate) : ""]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <CompStatusPill status={comp.status} />
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-blush px-2 py-2">
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">
                        Teams
                      </dt>
                      <dd className="font-heading text-lg tabular-nums">{teams}</dd>
                    </div>
                    <div className="rounded-lg bg-blush px-2 py-2">
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">
                        Judges
                      </dt>
                      <dd className="font-heading text-lg tabular-nums">{judges}</dd>
                    </div>
                    <div className="rounded-lg bg-blush px-2 py-2">
                      <dt className="text-[0.65rem] uppercase tracking-wide text-muted">
                        Packets
                      </dt>
                      <dd className="font-heading text-lg tabular-nums">
                        {packetsIn}/{comp.requiredJudgeCount}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto">
                    {live || comp.status === "READY" ? (
                      <LiveProgress
                        current={live ? comp.livePosition : null}
                        total={teams}
                        size="sm"
                      />
                    ) : comp.status === "COMPLETE" && comp.resultsReleasedAt ? (
                      <p className="text-sm text-success">
                        Results released {formatDateTime(comp.resultsReleasedAt)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted">
                        {comp.status === "UNCLAIMED"
                          ? "Waiting for a competition admin to claim it."
                          : comp.status === "APPS_OPEN"
                            ? [
                                comp.earlyApplicationDeadline
                                  ? `Early deadline ${formatDateTime(comp.earlyApplicationDeadline)}`
                                  : null,
                                comp.applicationDeadline
                                  ? `Late deadline ${formatDateTime(comp.applicationDeadline)}`
                                  : null,
                              ].filter(Boolean).join(" · ") || "Teams can still apply."
                            : comp._count.moderatorAccess === 0
                              ? "No moderator assigned yet. Grant access before viewing."
                              : "Open judging when viewing starts."}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
