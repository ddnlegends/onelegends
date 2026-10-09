import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getModeratorCompetitions } from "@/lib/moderator";
import { COMP_STATUS_LABEL, competitionStatus } from "@/lib/judging";
import { CompStatusPill } from "@/components/CompStatusPill";

export default async function ModeratorHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const competitions = await getModeratorCompetitions(session.user.id);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Moderator</p>
        <h1 className="font-heading text-4xl">Live Viewing</h1>
        <p className="mt-2 max-w-2xl text-muted">
          You run the videos from the competition page. Pick the live team by
          number; every judge’s sheet follows it while team identities stay
          hidden during judging.
        </p>
      </div>

      {competitions.length === 0 ? (
        <p className="text-muted">No competitions assigned yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {competitions.map((comp) => {
            const status = competitionStatus(comp);
            return (
              <li
                key={comp.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-card p-5"
              >
                <div className="space-y-2">
                  <CompStatusPill status={status} />
                  <h2 className="font-heading text-2xl">{comp.name}</h2>
                  <p className="text-sm text-muted">
                    {comp._count.applications} team
                    {comp._count.applications === 1 ? "" : "s"}
                    {status === "LIVE" && comp.livePosition != null
                      ? ` · Showing Team ${comp.livePosition}`
                      : ` · ${COMP_STATUS_LABEL[status]}`}
                  </p>
                </div>
                <Link
                  href={comp.resultsReleasedAt ? `/moderator/${comp.id}/results` : `/moderator/${comp.id}`}
                  className={
                    status === "LIVE" || status === "READY"
                      ? "btn btn-primary"
                      : "btn btn-ghost"
                  }
                >
                  {comp.resultsReleasedAt ? "View final rankings" : "Open live viewing"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
