import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformAdmin } from "@/lib/team-access";

export default async function LegacyLiveViewPage() {
  const session = await auth();
  if (session?.user && (await isPlatformAdmin(session.user.id))) {
    redirect("/ops/comps");
  }
  redirect("/comp");
}
