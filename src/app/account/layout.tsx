import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/PageShell";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <PageShell>{children}</PageShell>;
}
