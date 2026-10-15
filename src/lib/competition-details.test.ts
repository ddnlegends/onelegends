import { describe, expect, it } from "vitest";
import { formatApplicationFee, formatEventDateRange, parseApplicationFee, parseEventDate } from "./competition-details";
import { normalizePacketDriveUrl } from "./competition-packet";

describe("competition dates and fees", () => {
  it("rejects impossible dates and accepts leap days without timezone shifts", () => {
    for (const raw of ["2027-02-29", "2026-02-31", "2026-13-01", "0000-01-01", "2026-1-01", "hello"]) expect(parseEventDate(raw)).toBeNull();
    expect(parseEventDate("2028-02-29")?.toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(formatEventDateRange(parseEventDate("2026-10-15")!, parseEventDate("2026-10-15")!)).toBe("Oct 15, 2026");
    expect(formatEventDateRange(parseEventDate("2026-12-31")!, parseEventDate("2027-01-02")!)).toContain("2027");
  });
  it("keeps unknown fees distinct from free and stores exact cents", () => {
    expect(parseApplicationFee("")).toBeNull();
    expect(parseApplicationFee("0")).toBe(0);
    expect(parseApplicationFee("35.29")).toBe(3529);
    expect(parseApplicationFee("35.2")).toBe(3520);
    for (const raw of ["-1", "NaN", "Infinity", "1e2", "1.999", "100000", "$25"]) expect(parseApplicationFee(raw)).toBe("invalid");
    expect(formatApplicationFee(null)).toBe("Not provided");
    expect(formatApplicationFee(0)).toBe("$0.00");
  });
});

describe("application packet link validation", () => {
  const id = "1EvaXITNNCUf_u22R0gHwSxW7ytge3zaX";
  it("accepts a Drive file link and removes tracking parameters", () => {
    expect(normalizePacketDriveUrl(`https://drive.google.com/file/d/${id}/view?usp=sharing`)).toBe(`https://drive.google.com/file/d/${id}/view`);
    expect(normalizePacketDriveUrl(`https://drive.google.com/open?id=${id}`)).toBe(`https://drive.google.com/file/d/${id}/view`);
  });
  it("rejects non-file, insecure, and lookalike links", () => {
    for (const url of ["", `http://drive.google.com/file/d/${id}/view`, `https://drive.google.com.evil.test/file/d/${id}/view`, `https://drive.google.com/drive/folders/${id}`, "https://example.com/file.pdf"]) {
      expect(normalizePacketDriveUrl(url)).toBeNull();
    }
  });
});
