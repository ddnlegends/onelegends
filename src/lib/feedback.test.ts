import { describe, expect, it } from "vitest";
import { feedbackPagePath, feedbackSchema } from "./feedback";
import { signInRedirectPath } from "./roles";

describe("feedback input", () => {
  it("keeps only a local pathname, without query strings or fragments", () => {
    expect(feedbackPagePath("/team/profile?code=private#details")).toBe("/team/profile");
    for (const value of ["https://example.org", "//example.org", "/\\example.org", "/%2fexample.org", "/a\nb", ["/team"], "x", "/" + "a".repeat(500)]) {
      expect(feedbackPagePath(value)).toBe("");
    }
    expect(feedbackPagePath("/")).toBe("/");
  });

  it("validates category, message, and retry key without accepting identity fields", () => {
    const input = { category: "CONCERN", message: "  This needs attention.  ", submissionKey: crypto.randomUUID(), pagePath: "/dashboard?secret=1", submitterEmail: "spoof@example.org" };
    const parsed = feedbackSchema.parse(input);
    expect(parsed.message).toBe("This needs attention.");
    expect(parsed.pagePath).toBe("/dashboard");
    expect(parsed).not.toHaveProperty("submitterEmail");
    for (const patch of [{ message: "   " }, { message: "x".repeat(5001) }, { category: "INVALID" }, { submissionKey: "invalid" }]) {
      expect(feedbackSchema.safeParse({ ...input, ...patch }).success).toBe(false);
    }
  });

  it("permits only the feedback page as a sign-in redirect override", () => {
    expect(signInRedirectPath("/feedback")).toBe("/feedback");
    for (const path of [null, undefined, "https://evil.example", "//evil.example", "/feedback?next=https://evil.example", ["/feedback"], "/ops/feedback"]) {
      expect(signInRedirectPath(path)).toBe("/dashboard");
    }
  });
});
