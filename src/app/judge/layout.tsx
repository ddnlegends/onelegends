import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";
import { userHasJudgeAccess } from "@/lib/team-access";

export default async function JudgeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await userHasJudgeAccess(session.user.id))) redirect("/dashboard");
  return <PageShell>{children}</PageShell>;
}
