import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformAdmin } from "@/lib/team-access";

export default async function LegacyTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  redirect((await isPlatformAdmin(session.user.id)) ? `/ops/teams/${id}` : "/dashboard");
}
