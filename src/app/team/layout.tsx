import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { getApprovedTeamMemberships } from "@/lib/team-access";

export default async function TeamLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const memberships = await getApprovedTeamMemberships(session.user.id);
  if (memberships.length === 0) redirect("/dashboard");
  return <PageShell>{children}</PageShell>;
}
