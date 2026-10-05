import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { isPlatformAdmin } from "@/lib/team-access";

export default async function OpsTeamsLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await isPlatformAdmin(session.user.id))) redirect("/dashboard");
  return <PageShell>{children}</PageShell>;
}
