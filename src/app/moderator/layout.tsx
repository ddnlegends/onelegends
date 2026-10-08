import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { getNavAccess } from "@/lib/team-access";

export default async function ModeratorLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const access = await getNavAccess(session.user.id);
  if (!access.moderatorAccess) redirect("/dashboard");
  return <PageShell>{children}</PageShell>;
}
