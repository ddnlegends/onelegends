import type { ApplicationStatus } from "@prisma/client";
import type { RankedTeam } from "@/lib/results";
import type { ExportCell, ExportTable } from "@/lib/ops-export";
import { statusLabel } from "@/lib/utils";

export type DirectorApplicant = {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  viewingPosition: number | null;
  compPaymentReceivedAt: Date | null;
  team: {
    id: string;
    name: string;
    photoUrl: string;
    blurb: string;
    wikiUrl: string;
    avDriveUrl: string;
    captains: string;
    yearsEstablished: number | null;
    rosterSize: number | null;
    registrationPaidAt: Date | null;
    dancers: {
      name: string;
      inAV: boolean;
      pointOfContact: boolean;
      tshirtSize: string;
      dietaryRestrictions: string;
    }[];
  };
};

type WorkbookSheet = Pick<ExportTable, "title" | "rows">;

function number(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function date(value: Date | null): string {
  return value ? `${value.toISOString().replace("T", " ").slice(0, 16)} UTC` : "";
}

function logoLink(photoUrl: string, origin: string): string {
  if (!photoUrl) return "";
  try {
    return new URL(photoUrl, origin).toString();
  } catch {
    return "";
  }
}

/** The numeric/letter prefix makes names unique even after Excel's 31-character limit. */
function teamSheetName(name: string, prefix: string): string {
  const safe = [...name]
    .filter((character) => character >= " ")
    .join("")
    .replace(/[\[\]:*?/\\]/g, " ")
    .trim();
  return `${prefix} ${(safe || "Team").slice(0, 30 - prefix.length)}`;
}

export function buildDirectorApplicantWorkbook(
  applications: DirectorApplicant[],
  ranked: RankedTeam[],
  origin: string,
): WorkbookSheet[] {
  const ranking = new Map(ranked.map((row, index) => [row.applicationId, { row, rank: index + 1 }]));
  const ordered = [...applications].sort((left, right) => {
    const leftRank = ranking.get(left.id)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = ranking.get(right.id)?.rank ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.team.name.localeCompare(right.team.name);
  });

  const overview: ExportCell[][] = [[
    "Rank", "Team", "Application status", "Average z-score", "Average total (/50)",
    "Judges scored", "Captains", "Roster size", "AV link", "Applied (UTC)",
  ]];
  const judgeScores: ExportCell[][] = [[
    "Rank", "Team", "Judge", "Choreography", "Formations", "Technique",
    "Sync / cleanliness", "Overall impression", "Total (/50)", "Z-score", "Comment",
  ]];
  const sheets: WorkbookSheet[] = [];
  let unrankedCount = 0;

  for (const application of ordered) {
    const { team } = application;
    const result = ranking.get(application.id);
    const rank = result?.rank;
    const rankLabel = rank ?? "Unranked";
    const rosterSize = team.rosterSize ?? team.dancers.length;
    overview.push([
      rankLabel,
      team.name,
      statusLabel(application.status),
      result ? number(result.row.avgZ, 3) : "",
      result ? number(result.row.avgTotal, 2) : "",
      result?.row.judges.length ?? 0,
      team.captains,
      rosterSize,
      team.avDriveUrl,
      date(application.createdAt),
    ]);

    if (result) {
      for (const judge of [...result.row.judges].sort((a, b) => a.judgeName.localeCompare(b.judgeName))) {
        judgeScores.push([
          rank!, team.name, judge.judgeName,
          judge.scores.choreography, judge.scores.formations, judge.scores.technique,
          judge.scores.syncCleanliness, judge.scores.overallImpression,
          judge.total, number(judge.z, 3), judge.comment,
        ]);
      }
    }

    const profileRows: ExportCell[][] = [
      ["Profile", "Team", team.name],
      ["Profile", "Rank", rankLabel],
      ["Profile", "Average z-score", result ? number(result.row.avgZ, 3) : ""],
      ["Profile", "Average total (/50)", result ? number(result.row.avgTotal, 2) : ""],
      ["Profile", "Application status", statusLabel(application.status)],
      ["Profile", "Applied (UTC)", date(application.createdAt)],
      ["Profile", "Viewing order", application.viewingPosition ?? ""],
      ["Profile", "Host payment received", application.compPaymentReceivedAt ? "Yes" : "No"],
      ["Profile", "OneLegends registration paid", team.registrationPaidAt ? "Yes" : "No"],
      ["Profile", "Captains", team.captains],
      ["Profile", "Years established", team.yearsEstablished ?? ""],
      ["Profile", "Roster size", rosterSize],
      ["Profile", "AV dancers", team.dancers.filter((dancer) => dancer.inAV).map((dancer) => dancer.name).join(", ")],
      ["Profile", "AV link", team.avDriveUrl],
      ["Profile", "Team wiki", team.wikiUrl],
      ["Profile", "Team logo", logoLink(team.photoUrl, origin)],
      ["Profile", "Team blurb", team.blurb],
    ];
    const rosterRows: ExportCell[][] = [...team.dancers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((dancer) => [
        "Roster", dancer.name, "",
        dancer.inAV ? "Yes" : "No",
        dancer.pointOfContact ? "Yes" : "No",
        dancer.tshirtSize,
        dancer.dietaryRestrictions,
      ]);
    const prefix = rank ? String(rank).padStart(3, "0") : `U${String(++unrankedCount).padStart(2, "0")}`;
    sheets.push({
      title: teamSheetName(team.name, prefix),
      rows: [
        ["Section", "Field / dancer", "Value", "In AV", "Point of contact", "Shirt size", "Dietary restrictions"],
        ...profileRows,
        ...rosterRows,
      ],
    });
  }

  return [
    { title: "Rankings", rows: overview },
    ...sheets,
    { title: "Judge Scores", rows: judgeScores },
  ];
}
