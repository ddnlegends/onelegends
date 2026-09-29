import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformAdmin } from "@/lib/team-access";

export default async function LegacyLiveViewingPage() {
  const session = await auth();
  if (session?.user && (await isPlatformAdmin(session.user.id))) {
    redirect("/comp/progress");
  }
  redirect("/comp");
}
