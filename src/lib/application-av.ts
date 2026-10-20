/** Existing applications without a saved link keep their prior live-link behavior. */
export function submittedApplicationAvUrl(application: {
  submittedAvDriveUrl?: string | null;
  team: { avDriveUrl: string };
}): string {
  return application.submittedAvDriveUrl || application.team.avDriveUrl;
}
