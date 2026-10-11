import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/PageShell";
import { getActiveTeamId } from "@/lib/team-access";
import { dollars, TEAM_REGISTRATION_FEE_CENTS, PARTNER_COMP_REGISTRATION_FEE_CENTS, NON_PARTNER_COMP_REGISTRATION_FEE_CENTS } from "@/lib/payment-eligibility";

export default async function PaymentsPage() {
  const session = await auth();
  const teamId = session?.user ? await getActiveTeamId(session.user.id) : null;
  const team = teamId
    ? await prisma.teamProfile.findUnique({
        where: { id: teamId },
        select: { name: true, registrationPaidAt: true },
      })
    : null;
  const memo = `${team?.name || "{Team}"}'s OneLegends Payment`;

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Payment instructions
          </p>
          <h1 className="mt-2 font-heading text-4xl">Payments</h1>
          <p className="mt-3 text-muted">
            OneLegends does not collect or confirm payments in the app yet.
            OneLegends registration and a later payment to a competition are separate.
          </p>
        </div>

        <section className="rounded-xl border border-line bg-card p-6">
          <h2 className="font-heading text-xl">OneLegends registration fees</h2>
          <p className="mt-2 text-sm text-muted">Team: {dollars(TEAM_REGISTRATION_FEE_CENTS)} · Partner competition: {dollars(PARTNER_COMP_REGISTRATION_FEE_CENTS)} · Non-partner competition: {dollars(NON_PARTNER_COMP_REGISTRATION_FEE_CENTS)}. Tech admins verify these external payments before AV viewing.</p>
          {team ? (
            <p className="mt-2 text-sm">{team.registrationPaidAt ? "Your team's OneLegends registration is marked paid." : "Your team's OneLegends registration is still unpaid."}</p>
          ) : null}
          <p className="mt-2 text-sm text-muted">A team’s payment to a competition is due only after the competition’s final Accepted decision. The host tracks that payment separately.</p>
        </section>

        <ol className="list-decimal space-y-4 rounded-xl border border-line bg-card px-8 py-6 text-sm">
          <li>Confirm the correct recipient with circuit ops for OneLegends registration. Competition payments are arranged separately with the host after acceptance.</li>
          <li>
            Pay via Zelle or PayPal to{" "}
            <a href="mailto:legends@desidancenetwork.org" className="text-accent underline">
              legends@desidancenetwork.org
            </a>
            .
          </li>
          <li>
            Put this exact text in the payment memo or note:
            <strong className="mt-2 block rounded-lg bg-blush px-4 py-3 font-mono text-ink">
              {memo}
            </strong>
          </li>
          <li>
            Keep your receipt. Tech admins confirm OneLegends registration payments manually; competition hosts track their own payments after final acceptance.
          </li>
        </ol>

        <p className="rounded-xl border border-line bg-blush p-4 text-sm text-muted">
          Circuit ops can block a team while its OneLegends fee or a circuit issue is unresolved. Blocked teams are excluded from every competition’s applications and AV viewing.
        </p>

        <Link href={team ? "/team" : "/"} className="btn btn-ghost">
          {team ? "Back to team dashboard" : "Back to home"}
        </Link>
      </div>
    </PageShell>
  );
}
