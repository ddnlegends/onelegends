import { describe, expect, it } from "vitest";
import { EXPORT_DATASETS, isExportDatasetKey, toCsv } from "@/lib/ops-export";

describe("toCsv", () => {
  it("joins rows with CRLF and quotes cells that need it", () => {
    expect(
      toCsv([
        ["Team", "Score"],
        ['Say "hi", team', 42],
        ["Line\nbreak", 0],
      ]),
    ).toBe('Team,Score\r\n"Say ""hi"", team",42\r\n"Line\nbreak",0');
  });

  it("neutralizes cells that a spreadsheet would run as formulas", () => {
    expect(toCsv([["=HYPERLINK(\"x\")", "+1", "-2", "@SUM(A1)"]])).toBe(
      `"'=HYPERLINK(""x"")",'+1,'-2,'@SUM(A1)`,
    );
  });

  it("leaves numbers alone, including negatives", () => {
    expect(toCsv([[-1.5, 0, 10]])).toBe("-1.5,0,10");
  });
});

describe("isExportDatasetKey", () => {
  it("accepts every listed dataset and nothing else", () => {
    for (const dataset of EXPORT_DATASETS) {
      expect(isExportDatasetKey(dataset.key)).toBe(true);
    }
    expect(isExportDatasetKey("passwords")).toBe(false);
    expect(isExportDatasetKey(undefined)).toBe(false);
  });
});
