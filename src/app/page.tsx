import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BrandMark } from "@/components/BrandMark";
import { Lattice } from "@/components/Lattice";
import { RoleGuide } from "@/components/RoleGuide";
import { isCompetitionOpen } from "@/lib/judging";
import { formatDateTime } from "@/lib/utils";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const competitions = await prisma.competitionProfile.findMany({
    orderBy: [{ eventDate: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line bg-paper">
        <Lattice />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/legends-crown-md.png"
          loading="lazy"
          alt=""
          className="pointer-events-none absolute -right-16 top-8 hidden w-[28rem] opacity-[0.12] lg:block"
        />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-16 pt-12 text-center sm:pt-16">
          <p className="inline-flex rounded-full border border-line bg-blush px-3 py-1 font-heading text-[11px] tracking-[0.35em] text-accent">
            Brand new
          </p>
          <div className="mt-8">
            <BrandMark size="hero" />
          </div>
          <h1 className="mt-6 font-heading text-5xl tracking-[0.04em] sm:text-7xl md:text-8xl">
            <span className="brand-gradient-text inline-block">
              OneLegends
            </span>
          </h1>
          <p className="mt-4 text-sm font-light tracking-[0.28em] text-muted">
            #journeytothecrown
          </p>
          <p className="mx-auto mt-6 max-w-xl text-base text-ink/80 sm:text-lg">
            Applications for the Legends circuit. One team profile. Check the
            comps. Send once.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="btn btn-primary">
              Create account
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Log In
            </Link>
          </div>
        </div>
      </section>

      <RoleGuide signedIn={false} />

      <section className="border-y border-line bg-blush px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <div>
            <h2 className="font-heading text-2xl">How payments work</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Payments happen outside OneLegends for now. Confirm the recipient
              and amount, then include your team’s OneLegends payment memo.
            </p>
          </div>
          <Link href="/payments" className="btn btn-primary">
            Payment instructions
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <div>
          <h2 className="font-heading text-2xl tracking-[0.12em]">
            Competitions
          </h2>
          <p className="mt-2 max-w-xl text-muted">
            The full season list from each competition’s live details. Event
            date, city, venue, stage, and when apps close — then apply from
            your team profile.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line bg-card shadow-[0_12px_40px_rgba(142,28,66,0.06)]">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Competition</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Venue</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Apps close</th>
                <th className="px-4 py-3 font-medium">Apps</th>
              </tr>
            </thead>
            <tbody>
              {competitions.map((comp) => (
                <tr key={comp.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/comps/${comp.id}`}
                      className="font-semibold text-accent hover:underline"
                    >
                      {comp.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{comp.dates || "TBA"}</td>
                  <td className="px-4 py-3 text-muted">{comp.location || "TBA"}</td>
                  <td className="px-4 py-3 text-muted">{comp.venue || "TBA"}</td>
                  <td className="px-4 py-3 text-muted">{comp.stageSize || "TBA"}</td>
                  <td className="px-4 py-3 text-muted">
                    {comp.applicationDeadline
                      ? formatDateTime(comp.applicationDeadline)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {isCompetitionOpen(comp) ? (
                      <span className="font-semibold text-accent">Open</span>
                    ) : (
                      <span className="text-muted">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {competitions.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted">
              No competitions posted yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
