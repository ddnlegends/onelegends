import type { ApplicationStatus, TeamOfferResponse } from "@prisma/client";

export const PARTNER_CONFIRMATION_LIMIT = 3;

export function offerStatusLabel(application: {
  status: ApplicationStatus;
  teamOfferResponse: TeamOfferResponse;
  decisionsSubmittedAt: Date | null;
}): string {
  if (!application.decisionsSubmittedAt) return "Decision not announced";
  if (application.teamOfferResponse === "CONFIRMED") return "Confirmed by team";
  if (application.teamOfferResponse === "DECLINED") return "Declined by team";
  if (application.teamOfferResponse === "CAP_CLOSED") return "Unavailable · Partner limit reached";
  if (application.status === "ACCEPTED") return "Offer · response needed";
  if (application.status === "WAITLISTED") return "Waitlisted";
  if (application.status === "DECLINED") return "Declined by competition";
  return "Pending";
}
