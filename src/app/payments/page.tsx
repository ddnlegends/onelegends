import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/PageShell";
import { getActiveTeamId } from "@/lib/team-access";

export default async function PaymentsPage() {
  const session = await auth();
  const teamId = session?.user ? await getActiveTeamId(session.user.id) : null;
  const team = teamId
    ? await prisma.teamProfile.findUnique({
        where: { id: teamId },
        select: { name: true },
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
            Circuit dues and competition entry fees may have different recipients.
          </p>
        </div>

        <ol className="list-decimal space-y-4 rounded-xl border border-line bg-card px-8 py-6 text-sm">
          <li>Confirm the amount and the correct recipient with circuit ops or the competition host.</li>
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
            Keep your receipt. Circuit ops or the host confirms the payment manually;
            submitting an application does not confirm that payment was received.
          </li>
        </ol>

        <p className="rounded-xl border border-line bg-blush p-4 text-sm text-muted">
          Circuit ops can block a team from new applications while dues or a
          circuit issue is unresolved. Contact them after paying so they can
          verify and remove a dues block.
        </p>

        <Link href={team ? "/team" : "/"} className="btn btn-ghost">
          {team ? "Back to team dashboard" : "Back to home"}
        </Link>
      </div>
    </PageShell>
  );
}
