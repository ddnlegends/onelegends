import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/PageShell";
import { dashboardPath } from "@/lib/roles";

export default async function CompLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "COMP") redirect(dashboardPath(session.user.role));

  const competition = await prisma.competitionProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!competition) {
    return (
      <PageShell>
        <p className="text-muted">
          This login is not linked to a bid listing. Register as a competition
          with the official claim code.
        </p>
      </PageShell>
    );
  }

  return <PageShell>{children}</PageShell>;
}
