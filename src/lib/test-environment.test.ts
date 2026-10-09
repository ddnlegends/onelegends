import { describe, expect, it } from "vitest";
import { assertDisposableDatabase, isDisposableDatabase, testPasswordLoginAllowed, testPasswordLoginEnabled } from "./test-environment";

const local = {
  AUTH_ENABLE_TEST_LOGIN: "true",
  AUTH_URL: "http://127.0.0.1:3100",
  DATABASE_URL: "postgresql://postgres:fixture@127.0.0.1:54329/onelegends_e2e",
  DIRECT_URL: "postgresql://postgres:fixture@localhost:54329/onelegends_e2e",
  ALLOW_TEST_DATABASE_RESET: "1",
};

describe("destructive fixture boundary", () => {
  it("accepts only an explicitly opted-in disposable local database", () => {
    expect(() => assertDisposableDatabase(local)).not.toThrow();
    expect(() => assertDisposableDatabase({ ...local, ALLOW_TEST_DATABASE_RESET: undefined })).toThrow();
  });
  it.each([
    undefined, "not a URL", "postgresql://prod.example/onelegends_e2e",
    "postgresql://localhost/postgres", "https://localhost/onelegends_e2e",
    "postgresql://localhost.evil.example/onelegends_e2e",
    "postgresql://localhost/onelegends_e2e?host=prod.example",
    "postgresql://localhost/onelegends_e2e?hostaddr=192.0.2.1",
  ])("rejects unsafe targets without echoing credentials: %s", (url) => {
    expect(isDisposableDatabase(url)).toBe(false);
    for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
      expect(() => assertDisposableDatabase({ ...local, [key]: url })).toThrow(/Refusing/);
    }
  });
});

describe("local password login", () => {
  it("supports local production-build browser testing", () => {
    expect(testPasswordLoginEnabled({ ...local, NODE_ENV: "production" })).toBe(true);
  });
  it.each([
    { AUTH_ENABLE_TEST_LOGIN: undefined }, { AUTH_ENABLE_TEST_LOGIN: "false" },
    { VERCEL: "1" }, { VERCEL_ENV: "preview" },
    { AUTH_URL: "https://onelegends.vercel.app" }, { AUTH_URL: undefined },
    { DATABASE_URL: "postgresql://production.example/postgres" },
    { DIRECT_URL: "postgresql://production.example/postgres" },
  ])("denies hosted or incompletely configured environments: %j", (overrides) => {
    expect(testPasswordLoginEnabled({ ...local, ...overrides })).toBe(false);
  });
});

describe("temporary production test login", () => {
  const production = { ...local, VERCEL: "1", VERCEL_ENV: "production", AUTH_ENABLE_TEST_LOGIN: "false" };

  it.each([
    "legendstestadmin@gmail.com", "legendstestcomp@gmail.com",
    "legendstestmoderator@gmail.com", "legendstestuser@gmail.com",
  ])("accepts the named demonstration account %s", (email) => {
    expect(testPasswordLoginAllowed(email, production)).toBe(true);
  });

  it.each(["legendstech@desidancenetwork.org", "legendstestreg@gmail.com", "new@example.org"])(
    "refuses other production emails: %s",
    (email) => expect(testPasswordLoginAllowed(email, production)).toBe(false),
  );

  it("keeps preview deployments Google-only", () => {
    expect(testPasswordLoginAllowed("legendstestadmin@gmail.com", { ...production, VERCEL_ENV: "preview" })).toBe(false);
  });
});
