import { describe, expect, it } from "vitest";
import { formatApplicationFee, formatEventDateRange, parseApplicationFee, parseEventDate } from "./competition-details";
import { PACKET_MAX_BYTES, readApplicationPacket } from "./competition-packet";

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

describe("application packet validation", () => {
  it("checks actual file contents and sanitizes names", async () => {
    expect(await readApplicationPacket(new File(["<html>not a PDF</html>"], "packet.pdf", { type: "application/pdf" }))).toHaveProperty("error");
    expect(await readApplicationPacket(new File(["%PDF-1.7\ntruncated"], "packet.pdf"))).toHaveProperty("error");
    const valid = await readApplicationPacket(new File(["%PDF-1.7\n%%EOF\n"], 'packet"\r\n.pdf', { type: "application/pdf" }));
    expect(valid).toHaveProperty("filename", "packet___.pdf");
  });
  it("rejects empty, wrong-type and oversized files", async () => {
    for (const file of [new File([], "packet.pdf"), new File(["%PDF-1.7\n%%EOF"], "packet.html"), new File([new Uint8Array(PACKET_MAX_BYTES + 1)], "packet.pdf")]) {
      expect(await readApplicationPacket(file)).toHaveProperty("error");
    }
  });
});
