import { describe, expect, it } from "vitest";
import { normalizeTeamIdsDriveUrl } from "@/lib/team-ids-link";

const id = "aBcDeFgHiJkLmNoPqRsTuVwXyZ123";

describe("optional team IDs link", () => {
  it("accepts Drive files and folders without sharing parameters", () => {
    expect(normalizeTeamIdsDriveUrl(`https://drive.google.com/file/d/${id}/view?usp=sharing`))
      .toBe(`https://drive.google.com/file/d/${id}/view`);
    expect(normalizeTeamIdsDriveUrl(`https://drive.google.com/drive/folders/${id}?usp=drive_link`))
      .toBe(`https://drive.google.com/drive/folders/${id}`);
  });

  it("rejects lookalikes and unrelated links", () => {
    expect(normalizeTeamIdsDriveUrl(`https://drive.google.com.evil.example/file/d/${id}/view`)).toBeNull();
    expect(normalizeTeamIdsDriveUrl(`http://drive.google.com/file/d/${id}/view`)).toBeNull();
    expect(normalizeTeamIdsDriveUrl("https://example.com/ids.pdf")).toBeNull();
  });
});
