import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { isCompetitionOpen, isJudgingOpen } from "@/lib/judging";

export default async function JudgeDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const judge = await prisma.judgeProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      assignments: {
        include: { competition: true },
        orderBy: { requestedAt: "desc" },
      },
    },
  });
  if (!judge) redirect("/dashboard");

  const todo = judge.assignments.filter(
    (a) => a.status === "APPROVED" && !a.submittedAt,
  );
  const completed = judge.assignments.filter(
    (a) => a.status === "APPROVED" && a.submittedAt,
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-4xl">Judging</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Competitions invite you by email. You approve that invite on your
          dashboard. On viewing day, moderator shares each team’s video on
          screen and your anonymous score sheet follows along. You never see
          names.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">To-Do</h2>
        {todo.length === 0 ? (
          <p className="text-sm text-muted">No approved packets waiting.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {todo.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{row.competition.name}</p>
                  <p className="text-sm text-muted">
                    Permission accepted{" "}
                    {row.decidedAt ? formatDateTime(row.decidedAt) : "—"}
                    {isCompetitionOpen(row.competition)
                      ? " · Waiting for applications to close"
                      : isJudgingOpen(row.competition)
                        ? ""
                        : " · Waiting for judging to open"}
                  </p>
                </div>
                {isJudgingOpen(row.competition) ? (
                  <Link
                    href={`/judge/${row.competitionId}`}
                    className="btn btn-primary py-1.5"
                  >
                    Open Packet
                  </Link>
                ) : isCompetitionOpen(row.competition) ? (
                  <button className="btn btn-primary py-1.5" disabled type="button">
                    Open Packet
                  </button>
                ) : (
                  <Link
                    href={`/judge/${row.competitionId}`}
                    className="btn btn-ghost py-1.5"
                  >
                    View packet
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Completed</h2>
        {completed.length === 0 ? (
          <p className="text-sm text-muted">Nothing submitted yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {completed.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{row.competition.name}</p>
                  <p className="text-sm text-muted">
                    Completed {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}
                  </p>
                </div>
                <Link
                  href={`/judge/${row.competitionId}`}
                  className="btn btn-ghost py-1.5"
                >
                  Review Packet
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!judge.phone ? (
        <p className="text-sm text-muted">
          Add a phone number on{" "}
          <Link href="/judge/profile" className="underline">
            Judge Profile
          </Link>{" "}
          so competitions can reach you.
        </p>
      ) : null}
    </div>
  );
}
