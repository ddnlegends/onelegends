import { describe, expect, it } from "vitest";
import { submittedApplicationAvUrl } from "@/lib/application-av";

describe("application AV selection", () => {
  it("keeps a submitted link even when the live team profile changes", () => {
    expect(submittedApplicationAvUrl({
      submittedAvDriveUrl: "https://drive.google.com/file/d/original/view",
      team: { avDriveUrl: "https://drive.google.com/file/d/new/view" },
    })).toBe("https://drive.google.com/file/d/original/view");
  });

  it("preserves the live-link behavior for older applications", () => {
    expect(submittedApplicationAvUrl({
      submittedAvDriveUrl: null,
      team: { avDriveUrl: "https://drive.google.com/file/d/current/view" },
    })).toBe("https://drive.google.com/file/d/current/view");
  });
});
