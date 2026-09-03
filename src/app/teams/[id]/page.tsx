import { PageShell } from "@/components/PageShell";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { avDancerNames } from "@/lib/utils";
import { dashboardPath } from "@/lib/roles";

export default async function TeamPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEAM") redirect(dashboardPath(session.user.role));

  const { id } = await params;
  const team = await prisma.teamProfile.findUnique({
    where: { id },
    include: { dancers: { orderBy: { name: "asc" } } },
  });
  if (!team) notFound();

  return (
    <PageShell>
    <article className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        {team.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.photoUrl}
            alt={team.name}
            className="h-48 w-full rounded-xl object-cover sm:h-56 sm:w-72"
          />
        ) : null}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Team</p>
          <h1 className="font-heading text-4xl">{team.name}</h1>
          {team.blurb ? <p className="mt-3 max-w-xl text-muted">{team.blurb}</p> : null}
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Captains</dt>
              <dd>{team.captains || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Years established</dt>
              <dd>{team.yearsEstablished ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Rostered dancers</dt>
              <dd>{team.rosterSize ?? team.dancers.length}</dd>
            </div>
            <div>
              <dt className="text-muted">AV dancers</dt>
              <dd>{avDancerNames(team.dancers) || "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {team.avDriveUrl ? (
              <a href={team.avDriveUrl} className="underline" target="_blank" rel="noreferrer">
                AV Drive
              </a>
            ) : null}
            {team.wikiUrl ? (
              <a href={team.wikiUrl} className="underline" target="_blank" rel="noreferrer">
                Team wiki
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-sm text-muted">
        Hospitality details (dietary + shirts) go in each competition’s
        anonymous review packet, not this directory.
      </p>

      <Link href="/teams" className="text-sm underline">
        All teams
      </Link>
    </article>
    </PageShell>
  );
}
