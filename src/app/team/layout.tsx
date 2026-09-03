import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { dashboardPath } from "@/lib/roles";

export default async function TeamLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TEAM") redirect(dashboardPath(session.user.role));
  return <PageShell>{children}</PageShell>;
}
