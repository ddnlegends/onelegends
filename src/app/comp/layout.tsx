import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { getApprovedCompMemberships, isPlatformAdmin } from "@/lib/team-access";

export default async function CompLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const ops = await isPlatformAdmin(session.user.id);
  const memberships = await getApprovedCompMemberships(session.user.id);
  if (!ops && memberships.length === 0) redirect("/dashboard");
  return <PageShell>{children}</PageShell>;
}
