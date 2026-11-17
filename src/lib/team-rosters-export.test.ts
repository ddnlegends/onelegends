import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildTeamRosterSheets } from "./team-rosters-export";
import { toXlsx } from "./ops-export";

describe("all-team roster workbook", () => {
  it("keeps every saved roster field, including blank notes and dancers outside the AV", async () => {
    const sheets = buildTeamRosterSheets([
      { name: "Rhydhun", captains: "Zara", dancers: [
        { name: "Zara", tshirtSize: "XL", dietaryRestrictions: "Nut allergy\nVegetarian", inAV: false, pointOfContact: true },
        { name: "Anika", tshirtSize: "S", dietaryRestrictions: "", inAV: true, pointOfContact: false },
      ] },
      { name: "Origins", captains: "", dancers: [] },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await toXlsx(sheets));
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(["Origins", "Rhydhun"]);
    const roster = workbook.getWorksheet("Rhydhun")!;
    expect(roster.getRow(1).values).toEqual([undefined, "Team", "Dancer", "Shirt size", "Dietary restrictions / allergies", "In AV", "Point of contact", "Role"]);
    expect(roster.getRow(2).values).toEqual([undefined, "Rhydhun", "Anika", "S", "", "Yes", "No", "Member"]);
    expect(roster.getRow(3).values).toEqual([undefined, "Rhydhun", "Zara", "XL", "Nut allergy\nVegetarian", "No", "Yes", "Captain"]);
    expect(roster.getCell("D3").alignment?.wrapText).toBe(true);
    expect(workbook.getWorksheet("Origins")!.getCell("B2").value).toBe("No dancers added yet.");
  });

  it("matches full captain names without confusing points of contact or partial names", () => {
    const names = ["  aNiKa   Shah  ", "Dev Patel", "Sam Lee", "Maya Rao", "Anika", "Zara"];
    const dancers = names.map(name => ({ name, tshirtSize: "M", dietaryRestrictions: "", inAV: true, pointOfContact: name === "Zara" }));
    const [sheet] = buildTeamRosterSheets([{
      name: "Team", captains: "Anika Shah, Dev Patel; Sam Lee",
      captainContacts: [{ name: "Maya Rao", phone: "555-1234" }], dancers,
    }]);
    const roles = new Map(sheet.rows.slice(1).map(row => [row[1], row[6]]));
    for (const name of names.slice(0, 4)) expect(roles.get(name)).toBe("Captain");
    expect(roles.get("Anika")).toBe("Member");
    expect(roles.get("Zara")).toBe("Member");
    const [missing] = buildTeamRosterSheets([{ name: "Team", captains: "", captainContacts: null, dancers }]);
    expect(missing.rows.slice(1).every(row => row[6] === "Not specified")).toBe(true);
  });

  it("handles duplicate, long, reserved, and invalid tab names without losing full team names", async () => {
    const names = ["A".repeat(40) + " One", "A".repeat(40) + " Two", "Alpha/Beta", "Alpha:Beta", "History", "'Team'", "TEAM", "[]/*?:"];
    const sheets = buildTeamRosterSheets(names.map(name => ({ name, captains: "", dancers: [] })));
    expect(new Set(sheets.map(sheet => sheet.title.toLowerCase())).size).toBe(names.length);
    for (const sheet of sheets) {
      expect(sheet.title.length).toBeGreaterThan(0);
      expect(sheet.title.length).toBeLessThanOrEqual(31);
      expect(sheet.title).not.toMatch(/[:\\/?*\[\]]|^'|'$/);
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await toXlsx(sheets));
    expect(workbook.worksheets).toHaveLength(names.length);
    expect(workbook.worksheets.map(sheet => sheet.getCell("A2").value).sort()).toEqual([...names].sort());
  });

  it("produces a usable empty export and keeps formula-like roster text as plain strings", async () => {
    const empty = new ExcelJS.Workbook();
    await empty.xlsx.load(await toXlsx(buildTeamRosterSheets([])));
    expect(empty.worksheets).toHaveLength(1);
    expect(empty.worksheets[0].getCell("A2").value).toBe("No teams have been added yet.");
    const value = '=HYPERLINK("https://example.org")';
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await toXlsx(buildTeamRosterSheets([{ name: "Team", captains: "", dancers: [{ name: value, tshirtSize: "M", dietaryRestrictions: "+Not a formula", inAV: true, pointOfContact: true }] }])));
    expect(workbook.worksheets[0].getCell("B2").type).toBe(ExcelJS.ValueType.String);
    expect(workbook.worksheets[0].getCell("B2").value).toBe(value);
    expect(workbook.worksheets[0].getCell("D2").value).toBe("+Not a formula");
  });
});
