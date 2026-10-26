import { describe, expect, it } from "vitest";
import { INITIAL_REG_ASSIGNMENTS, resolveInitialRegAssignments } from "./reg-assignments";

describe("initial Partner Competition Reg assignments", () => {
  it("covers 21 distinct screenshot rows, including Motor City Dhamaal and Aag Ki Raat", () => {
    expect(INITIAL_REG_ASSIGNMENTS).toHaveLength(21);
    expect(INITIAL_REG_ASSIGNMENTS.filter((row) => row.email === "chinmayi.mohite@desidancenetwork.org").map((row) => row.name))
      .toEqual(expect.arrayContaining(["Motor City Dhamaal", "Aag Ki Raat"]));
  });

  it("matches explicit aliases but refuses missing, duplicate, or Non-partner records", () => {
    const competitions = INITIAL_REG_ASSIGNMENTS.map((row, index) => ({
      id: String(index),
      name: row.name === "ADZ" ? "Aa Dekhen Zara" : row.name === "AKD" ? "Aaj Ka Dhamaka" : row.name,
      isPartner: true,
    }));
    const result = resolveInitialRegAssignments(competitions);
    expect(result.issues).toEqual([]);
    expect(result.matches).toHaveLength(21);
    expect(resolveInitialRegAssignments(competitions.filter((row) => row.name !== "Aag Ki Raat")).issues)
      .toContain("Aag Ki Raat: expected one competition record; found 0.");
    expect(resolveInitialRegAssignments([...competitions, { id: "duplicate", name: "Tufaan", isPartner: true }]).issues)
      .toContain("Tufaan: expected one competition record; found 2.");
    expect(resolveInitialRegAssignments(competitions.map((row) => row.name === "Motor City Dhamaal" ? { ...row, isPartner: false } : row)).issues)
      .toContain("Motor City Dhamaal: Motor City Dhamaal is marked Non-partner.");
  });
});
