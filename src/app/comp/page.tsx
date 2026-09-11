import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isCompetitionOpen } from "@/lib/judging";
import {
  getActiveCompetitionId,
  getApprovedCompMemberships,
} from "@/lib/team-access";
import { setActiveCompAction } from "@/app/actions/team-access";

function shuffle<T>(items: T[], seed: string): T[] {
  const copy = [...items];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  for (let i = copy.length - 1; i > 0; i -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const j = hash % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default async function CompDashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const competitionId = await getActiveCompetitionId(userId);
  if (!competitionId) return null;
  const memberships = await getApprovedCompMemberships(userId);
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      applications: {
        include: {
          team: { include: { dancers: true } },
        },
      },
    },
  });
  if (!competition) return null;

  const apps = competition.applications;
  const teamCount = apps.length;
  const rosterSizes = apps.map(
    (app) => app.team.rosterSize ?? app.team.dancers.length,
  );
  const years = apps
    .map((app) => app.team.yearsEstablished)
    .filter((value): value is number => value != null);
  const withAv = apps.filter((app) => app.team.avDriveUrl.trim()).length;
  const dietaryNotes = apps.reduce(
    (sum, app) =>
      sum +
      app.team.dancers.filter((dancer) => dancer.dietaryRestrictions.trim())
        .length,
    0,
  );
  const pending = apps.filter((app) => app.status === "PENDING").length;
  const avgRoster =
    rosterSizes.length === 0
      ? 0
      : Math.round(
          rosterSizes.reduce((sum, n) => sum + n, 0) / rosterSizes.length,
        );
  const avgYears =
    years.length === 0
      ? 0
      : Math.round(years.reduce((sum, n) => sum + n, 0) / years.length);

  const stats = shuffle(
    [
      { label: "Teams Applied", value: String(teamCount) },
      { label: "Pending Packets", value: String(pending) },
      { label: "AVs On File", value: String(withAv) },
      { label: "Avg Roster Size", value: teamCount ? String(avgRoster) : "—" },
      { label: "Avg Years Established", value: years.length ? String(avgYears) : "—" },
      { label: "Dietary Notes Logged", value: String(dietaryNotes) },
    ],
    competition.id,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-4xl">{competition.name}</h1>
          <p className="mt-2 text-muted">
            {isCompetitionOpen(competition)
              ? "Accepting Applications."
              : "Applications Closed."}{" "}
            {competition.dates}{" "}
            {competition.location ? `· ${competition.location}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/comp/judges" className="btn btn-ghost">
            Judges
          </Link>
          <Link href="/comp/access" className="btn btn-ghost">
            Admins
          </Link>
          <Link href="/comp/profile" className="btn btn-ghost">
            Edit Details
          </Link>
        </div>
      </div>

      {memberships.length > 1 ? (
        <form action={setActiveCompAction} className="flex flex-wrap items-end gap-3">
          <div className="field">
            <label htmlFor="active-comp">Active competition</label>
            <select
              key={competitionId}
              id="active-comp"
              name="competitionId"
              defaultValue={competitionId}
            >
              {memberships.map((m) => (
                <option key={m.competitionId} value={m.competitionId}>
                  {m.competition.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-ghost" type="submit">
            Switch
          </button>
        </form>
      ) : null}

      <div className="rounded-xl border border-line bg-blush p-5">
        <p className="text-sm text-ink/80">
          This login shows <strong>how many</strong> teams applied and aggregate
          stats only. Team names stay sealed until the required number of judges
          submit. Approve judges and read ranked results from the Judges and
          Viewing Results pages.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-heading text-2xl">Application Stats</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-line bg-card p-5"
            >
              <p className="text-xs uppercase tracking-wide text-muted">
                {stat.label}
              </p>
              <p className="mt-2 font-heading text-3xl text-accent">{stat.value}</p>
            </div>
          ))}
        </div>
        {teamCount === 0 ? (
          <p className="mt-4 text-sm text-muted">No applications yet.</p>
        ) : null}
      </section>
    </div>
  );
}
