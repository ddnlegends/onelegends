import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildDirectorApplicantWorkbook, type DirectorApplicant } from "@/lib/comp-applicants-export";
import { toXlsx } from "@/lib/ops-export";
import type { RankedTeam } from "@/lib/results";

describe("director applicant workbook", () => {
  it("orders ranked teams first and includes profiles, rosters, and judge scores", async () => {
    const team = (id: string, name: string): DirectorApplicant["team"] => ({
      id,
      name,
      photoUrl: `/api/teams/${id}/photo`,
      blurb: "Team bio",
      wikiUrl: "https://example.com/wiki",
      avDriveUrl: `https://drive.google.com/file/d/${id}/view`,
      captains: "Captain Name",
      yearsEstablished: 2020,
      rosterSize: 1,
      registrationPaidAt: new Date("2027-01-01T00:00:00Z"),
      dancers: [{ name: "Dancer One", inAV: true, pointOfContact: true, tshirtSize: "M", dietaryRestrictions: "Vegetarian" }],
    });
    const applications: DirectorApplicant[] = [
      { id: "unranked", status: "PENDING", createdAt: new Date("2027-01-02T00:00:00Z"), viewingPosition: null, compPaymentReceivedAt: null, team: team("u", "Unranked Team") },
      { id: "ranked", status: "ACCEPTED", submittedAvDriveUrl: "https://drive.google.com/file/d/submitted/view", appliedPhase: "EARLY", expectedFeeCents: 2500, createdAt: new Date("2027-01-01T00:00:00Z"), viewingPosition: 1, compPaymentReceivedAt: new Date("2027-01-03T00:00:00Z"), team: team("r", "Ranked / Team: *") },
    ];
    const ranked: RankedTeam[] = [{
      applicationId: "ranked", teamId: "r", name: "Ranked / Team: *", status: "ACCEPTED", viewingPosition: 1,
      avgTotal: 42, avgZ: 1.23456,
      judges: [{ judgeName: "Judge A", scores: { choreography: 9, formations: 8, technique: 8, syncCleanliness: 8, overallImpression: 9 }, total: 42, z: 1.23456, comment: "Strong work" }],
    }];

    const sheets = buildDirectorApplicantWorkbook(applications, ranked, "https://onelegends.org");
    expect(sheets.map((sheet) => sheet.title)).toEqual([
      "Rankings", "001 Ranked   Team", "U01 Unranked Team", "Judge Scores",
    ]);
    expect(sheets[0].rows[1].slice(0, 5)).toEqual([1, "Ranked / Team: *", "Accepted", 1.235, 42]);
    expect(sheets[0].rows[2].slice(0, 4)).toEqual(["Unranked", "Unranked Team", "Pending", ""]);
    expect(sheets[1].rows).toContainEqual(["Profile", "AV link", "https://drive.google.com/file/d/submitted/view"]);
    expect(sheets[1].rows).toContainEqual(["Profile", "Applied phase", "Early"]);
    expect(sheets[1].rows).toContainEqual(["Profile", "Expected host fee (USD)", "$25.00"]);
    expect(sheets[1].rows).toContainEqual(["Profile", "Team logo", "https://onelegends.org/api/teams/r/photo"]);
    expect(sheets[1].rows).toContainEqual(["Roster", "Dancer One", "", "Yes", "Yes", "M", "Vegetarian"]);
    expect(sheets[3].rows[1]).toEqual([1, "Ranked / Team: *", "Judge A", 9, 8, 8, 8, 9, 42, 1.235, "Strong work"]);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await toXlsx(sheets));
    expect(workbook.worksheets).toHaveLength(4);
    expect(workbook.getWorksheet("Judge Scores")?.getCell("B2").value).toBe("Ranked / Team: *");
  });
});
