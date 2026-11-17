import type { ExportTable } from "@/lib/ops-export";
import { captainContactsFromJson } from "@/lib/captain-contacts";

type RosterTeam = {
  name: string;
  captains: string;
  captainContacts?: unknown;
  dancers: {
    name: string;
    tshirtSize: string;
    dietaryRestrictions: string;
    inAV: boolean;
    pointOfContact: boolean;
  }[];
};

const HEADERS = ["Team", "Dancer", "Shirt size", "Dietary restrictions / allergies", "In AV", "Point of contact", "Role"];

function normalizedName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function captainNames(team: RosterTeam): Set<string> {
  return new Set([
    ...team.captains.split(/[,;\n&]|\s+and\s+/i),
    ...captainContactsFromJson(team.captainContacts).map(contact => contact.name),
  ].map(normalizedName).filter(Boolean));
}

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

/** Saved roster fields and roles matched to profile captain names; no account or legacy fields. */
export function buildTeamRosterSheets(teams: RosterTeam[]): (Pick<ExportTable, "title" | "rows"> & { wrapText: true })[] {
  const used = new Set<string>();
  if (!teams.length) return [{ title: "No teams", rows: [HEADERS, ["No teams have been added yet."]], wrapText: true }];
  return [...teams].sort((a, b) => a.name.localeCompare(b.name)).map(team => {
    const captains = captainNames(team);
    return {
      title: sheetName(team.name, used),
      wrapText: true,
      rows: [
        HEADERS,
        ...(team.dancers.length ? [...team.dancers].sort((a, b) => a.name.localeCompare(b.name)).map(dancer => [
          team.name, dancer.name, dancer.tshirtSize, dancer.dietaryRestrictions,
          dancer.inAV ? "Yes" : "No", dancer.pointOfContact ? "Yes" : "No",
          captains.has(normalizedName(dancer.name)) ? "Captain" : captains.size ? "Member" : "Not specified",
        ]) : [[team.name, "No dancers added yet.", "", "", "", "", ""]]),
      ],
    };
  });
}
