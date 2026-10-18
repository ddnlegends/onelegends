import { describe, expect, it } from "vitest";
import { teamVisibleApplicationStatus } from "@/lib/application-decisions";

describe("teamVisibleApplicationStatus", () => {
  it("keeps every draft outcome pending until the host submits the batch", () => {
    expect(teamVisibleApplicationStatus("ACCEPTED", null)).toBe("PENDING");
    expect(teamVisibleApplicationStatus("WAITLISTED", null)).toBe("PENDING");
    expect(teamVisibleApplicationStatus("DECLINED", null)).toBe("PENDING");
    expect(teamVisibleApplicationStatus("ACCEPTED", new Date())).toBe("ACCEPTED");
  });
});
