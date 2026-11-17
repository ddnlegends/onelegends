import type { ExportTable } from "@/lib/ops-export";

type RosterTeam = {
  name: string;
  dancers: {
    name: string;
    tshirtSize: string;
    dietaryRestrictions: string;
    inAV: boolean;
    pointOfContact: boolean;
  }[];
};

const HEADERS = ["Team", "Dancer", "Shirt size", "Dietary restrictions / allergies", "In AV", "Point of contact"];

function sheetName(name: string, used: Set<string>): string {
  const cleaned = name.replace(/[:\\/?*\[\]\u0000-\u001f\u007f\ufffe\uffff]/g, " ").trim().replace(/^'+|'+$/g, "").trim();
  const base = !cleaned ? "Team" : cleaned.toLowerCase() === "history" ? `${cleaned} team` : cleaned;
  for (let index = 1; ; index++) {
    const suffix = index === 1 ? "" : ` (${index})`;
    const title = base.slice(0, 31 - suffix.length).replace(/[\ud800-\udbff]$/, "").trimEnd().replace(/'+$/, "") + suffix;
    if (!used.has(title.toLowerCase())) {
      used.add(title.toLowerCase());
      return title;
    }
  }
}

/** Only saved roster fields; no claim codes, accounts, or legacy removed fields. */
export function buildTeamRosterSheets(teams: RosterTeam[]): (Pick<ExportTable, "title" | "rows"> & { wrapText: true })[] {
  const used = new Set<string>();
  if (!teams.length) return [{ title: "No teams", rows: [HEADERS, ["No teams have been added yet."]], wrapText: true }];
  return [...teams].sort((a, b) => a.name.localeCompare(b.name)).map(team => ({
    title: sheetName(team.name, used),
    wrapText: true,
    rows: [
      HEADERS,
      ...(team.dancers.length ? [...team.dancers].sort((a, b) => a.name.localeCompare(b.name)).map(dancer => [
        team.name, dancer.name, dancer.tshirtSize, dancer.dietaryRestrictions,
        dancer.inAV ? "Yes" : "No", dancer.pointOfContact ? "Yes" : "No",
      ]) : [[team.name, "No dancers added yet.", "", "", "", ""]]),
    ],
  }));
}
