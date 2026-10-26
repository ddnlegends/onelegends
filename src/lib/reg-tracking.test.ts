import { describe, expect, it } from "vitest";
import { regAvFingerprint, regAvReviewStatus } from "./reg-tracking";

describe("Reg AV review", () => {
  const apps = [
    { id: "a", submittedAvDriveUrl: "https://drive.google.com/file/d/first/view", team: { avDriveUrl: "old" } },
    { id: "b", submittedAvDriveUrl: null, team: { avDriveUrl: "https://drive.google.com/file/d/second/view" } },
  ];

  it("is order independent and becomes stale when an AV or application changes", () => {
    const fingerprint = regAvFingerprint(apps);
    expect(regAvFingerprint([...apps].reverse())).toBe(fingerprint);
    const assignment = { avReviewedAt: new Date(), avReviewFingerprint: fingerprint };
    expect(regAvReviewStatus(assignment, apps)).toBe("current");
    expect(regAvReviewStatus(assignment, [{ ...apps[0], submittedAvDriveUrl: "changed" }, apps[1]])).toBe("stale");
    expect(regAvReviewStatus(assignment, apps.slice(0, 1))).toBe("stale");
  });
});
