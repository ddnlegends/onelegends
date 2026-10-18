import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { MarkAllRegistrationPaidForm, RegistrationPaymentForm } from "@/components/PaymentForms";
import { requirePlatformAdminPage } from "@/lib/page-guards";
import { dollars } from "@/lib/payment-eligibility";
import { prisma } from "@/lib/prisma";
import { formatDate, statusLabel } from "@/lib/utils";

export default async function OpsPaymentsPage() {
  await requirePlatformAdminPage();
  const [teams, competitions, accepted] = await Promise.all([
    prisma.teamProfile.findMany({ orderBy: { name: "asc" } }),
    prisma.competitionProfile.findMany({ orderBy: { name: "asc" } }),
    prisma.application.findMany({
      where: {
        OR: [
          { status: "ACCEPTED", competition: { decisionsSubmittedAt: { not: null } } },
          { compPaymentReceivedAt: { not: null } },
        ],
      },
      select: {
        id: true,
        status: true,
        compPaymentReceivedAt: true,
        team: { select: { name: true } },
        competition: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const unpaidTeams = teams.filter((team) => !team.registrationPaidAt).length;
  const unpaidCompetitions = competitions.filter((competition) => !competition.registrationPaidAt).length;
  return (
    <PageShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl">Payment tracking</h1>
            <p className="mt-2 text-muted">Verify external OneLegends registration payments here. Competition hosts record their own payments after final acceptance.</p>
          </div>
          <MarkAllRegistrationPaidForm unpaidTeams={unpaidTeams} unpaidCompetitions={unpaidCompetitions} />
        </div>
        <section className="space-y-3">
          <h2 className="font-heading text-2xl">Teams · OneLegends fee</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {teams.map((team) => (
              <li key={team.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <Link href={`/ops/teams/${team.id}`} className="font-semibold hover:underline">{team.name}</Link>
                  <p className="text-sm text-muted">{dollars(team.registrationFeeCents)} · {team.registrationPaidAt ? `Paid ${formatDate(team.registrationPaidAt)}` : "Unpaid"}{team.applyBlocked ? " · Blocked" : ""}</p>
                </div>
                <RegistrationPaymentForm kind="team" id={team.id} paid={Boolean(team.registrationPaidAt)} />
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="font-heading text-2xl">Competitions · OneLegends fee</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {competitions.map((competition) => (
              <li key={competition.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <Link href={`/ops/competitions`} className="font-semibold hover:underline">{competition.name}</Link>
                  <p className="text-sm text-muted">{competition.isPartner ? "Partner" : "Non-partner"} · {dollars(competition.registrationFeeCents)} · {competition.registrationPaidAt ? `Paid ${formatDate(competition.registrationPaidAt)}` : "Unpaid"}</p>
                </div>
                <RegistrationPaymentForm kind="competition" id={competition.id} paid={Boolean(competition.registrationPaidAt)} />
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="font-heading text-2xl">Accepted teams · host payments</h2>
          <p className="text-sm text-muted">Hosts check these payments in Applied Teams. This section is read only.</p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {accepted.map((application) => (
              <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>{application.team.name} · {application.competition.name} · {statusLabel(application.status)}</span>
                <span className="text-muted">{application.compPaymentReceivedAt ? `Received ${formatDate(application.compPaymentReceivedAt)}` : "Outstanding"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
