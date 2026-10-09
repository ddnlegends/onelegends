import { auth } from "@/auth";
import { RoleGuide } from "@/components/RoleGuide";

export const metadata = { title: "How it works | OneLegends" };

export default async function GuidePage() {
  const session = await auth();
  return <RoleGuide signedIn={Boolean(session?.user)} standalone />;
}
