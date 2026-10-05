import { describe, expect, it } from "vitest";
import { isLegacyTestLogin, parseAuthIntent } from "@/lib/auth-policy";

describe("parseAuthIntent", () => {
  it("only allows account creation for an explicit register intent", () => {
    expect(parseAuthIntent("register")).toBe("register");
    expect(parseAuthIntent("login")).toBe("login");
    expect(parseAuthIntent(undefined)).toBe("login");
    expect(parseAuthIntent("REGISTER")).toBe("login");
    expect(parseAuthIntent("anything")).toBe("login");
  });
});

describe("isLegacyTestLogin", () => {
  it("matches the allowlist regardless of case and spacing", () => {
    expect(isLegacyTestLogin(" LegendsTestUser@gmail.com ")).toBe(true);
    expect(isLegacyTestLogin("someone@gmail.com")).toBe(false);
  });
});
