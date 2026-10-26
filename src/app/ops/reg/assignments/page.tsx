import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminPage } from "@/lib/page-guards";
import { RegAssignmentForm } from "@/components/RegForms";

export default async function RegAssignmentsPage() {
  await requirePlatformAdminPage();
  const [competitions, admins, invites, audits] = await Promise.all([
    prisma.competitionProfile.findMany({ where: { isPartner: true }, select: {
      id: true, name: true, eventDate: true, regAssignment: { select: { email: true } },
    }, orderBy: [{ eventDate: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({ where: { platformAdmin: true, email: { endsWith: "@desidancenetwork.org" } }, select: { email: true, name: true }, orderBy: { email: "asc" } }),
    prisma.platformAdminInvite.findMany({ where: { email: { endsWith: "@desidancenetwork.org" } }, select: { email: true }, orderBy: { email: "asc" } }),
    prisma.competitionRegAssignmentAudit.findMany({ orderBy: { changedAt: "desc" }, take: 30 }),
  ]);
  const contacts = [...admins.map((admin) => ({ email: admin.email.toLowerCase(), name: admin.name.trim() || admin.email })),
    ...invites.filter((invite) => !admins.some((admin) => admin.email.toLowerCase() === invite.email.toLowerCase()))
      .map((invite) => ({ email: invite.email.toLowerCase(), name: invite.email, pending: true }))];
  return <div className="space-y-8">
    <div><Link href="/ops/reg" className="text-sm text-accent underline">← My Partner Comps</Link>
      <h1 className="mt-3 font-heading text-4xl">Reg assignments</h1>
      <p className="mt-2 text-muted">Assign one tech admin point of contact to each Partner Competition. Reassignments keep existing Reg notes and review history.</p></div>
    <div className="space-y-3">{competitions.map((comp) => <section key={comp.id} className="rounded-xl border border-line bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3"><h2 className="font-heading text-xl">{comp.name}</h2><span className="text-sm text-muted">{comp.eventDate?.toLocaleDateString("en-US", { timeZone: "UTC" }) ?? "Date TBD"}</span></div>
      <RegAssignmentForm competitionId={comp.id} currentEmail={comp.regAssignment?.email ?? null} contacts={contacts} />
    </section>)}</div>
    {!competitions.length && <p>No Partner Competitions yet.</p>}
    <section className="space-y-3"><h2 className="font-heading text-2xl">Recent assignment changes</h2>
      {!audits.length ? <p className="text-muted">No changes yet.</p> : <ul className="space-y-2 text-sm">{audits.map((audit) => <li key={audit.id} className="rounded-lg border border-line bg-card p-3">{audit.competitionName}: {audit.oldEmail ?? "Unassigned"} → {audit.newEmail ?? "Unassigned"} · {audit.changedByEmail} · {audit.changedAt.toLocaleString("en-US")}</li>)}</ul>}</section>
  </div>;
}
