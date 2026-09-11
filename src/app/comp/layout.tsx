import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { getApprovedCompMemberships } from "@/lib/team-access";

export default async function CompLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const memberships = await getApprovedCompMemberships(session.user.id);
  if (memberships.length === 0) redirect("/dashboard");
  return <PageShell>{children}</PageShell>;
}
