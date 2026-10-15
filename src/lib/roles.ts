export function dashboardPath(): string {
  return "/dashboard";
}

/** Only this explicit local destination may override the usual sign-in landing. */
export function signInRedirectPath(value: unknown): string {
  return value === "/feedback" ? "/feedback" : dashboardPath();
}
