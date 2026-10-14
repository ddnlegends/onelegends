import { auth } from "@/auth";
import { RoleGuide } from "@/components/RoleGuide";
import { getNavAccess } from "@/lib/team-access";

const TEAM_VIDEO_URL = "https://drive.google.com/file/d/1EvaXITNNCUf_u22R0gHwSxW7ytge3zaX/view?usp=drive_link";
const COMP_VIDEO_URL = "https://drive.google.com/file/d/1LpayQ7KwPVdYpaQ6gr6FyqC8r71LZke6/view?usp=drive_link";

export const metadata = { title: "How it works | OneLegends" };

export default async function GuidePage() {
  const session = await auth();
  const access = session?.user?.id ? await getNavAccess(session.user.id) : null;
  return (
    <RoleGuide
      signedIn={Boolean(session?.user)}
      standalone
      teamVideoUrl={access?.teamAccess ? TEAM_VIDEO_URL : undefined}
      compVideoUrl={access?.compAccountAccess ? COMP_VIDEO_URL : undefined}
    />
  );
}
