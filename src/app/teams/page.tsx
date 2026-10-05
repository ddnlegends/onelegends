import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformAdmin } from "@/lib/team-access";

export default async function TeamsDirectoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect((await isPlatformAdmin(session.user.id)) ? "/ops/teams" : "/dashboard");
}
