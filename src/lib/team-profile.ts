import { parseDriveUrl } from "@/lib/drive";
import { hasTeamPhoto } from "@/lib/team-photo";

export type TeamProfileForApply = {
  name: string;
  photoUrl: string;
  blurb: string;
  avDriveUrl: string;
  captains: string;
  yearsEstablished: number | null;
  dancers: { name: string; tshirtSize: string }[];
};

export function teamProfileGaps(team: TeamProfileForApply): string[] {
  const missing: string[] = [];

  if (team.name.trim().length < 2) missing.push("team name");
  if (!team.captains.trim()) missing.push("captains");
  if (team.yearsEstablished == null || !Number.isFinite(team.yearsEstablished)) {
    missing.push("years established");
  }
  if (!hasTeamPhoto(team.photoUrl)) missing.push("team logo");
  if (!team.blurb.trim()) missing.push("team blurb");

  const drive = parseDriveUrl(team.avDriveUrl);
  if (!drive) {
    missing.push("AV Google Drive file link");
  } else if (drive.kind === "folder") {
    missing.push("AV as a Drive file link (not a folder)");
  }

  const dancers = team.dancers.filter((d) => d.name.trim());
  if (dancers.length === 0) {
    missing.push("at least one dancer on the roster");
  } else if (dancers.some((d) => !d.tshirtSize.trim())) {
    missing.push("a t-shirt size for every dancer");
  }

  return missing;
}

export function teamProfileReady(team: TeamProfileForApply): boolean {
  return teamProfileGaps(team).length === 0;
}

export function teamProfileBlockedMessage(gaps: string[]): string {
  if (gaps.length === 0) return "";
  return `Finish your team profile before applying: ${gaps.join(", ")}.`;
}

export const TEAM_APPLY_OPS_BLOCKED_MESSAGE =
  "Circuit ops has blocked this team from applying. This is usually unpaid dues or a circuit rules issue. Contact Legends Admin if you think this is a mistake.";
