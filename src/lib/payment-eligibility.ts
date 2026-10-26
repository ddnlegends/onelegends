import type { Prisma } from "@prisma/client";

export const TEAM_REGISTRATION_FEE_CENTS = 2500;
export const PARTNER_COMP_REGISTRATION_FEE_CENTS = 2500;
export const NON_PARTNER_COMP_REGISTRATION_FEE_CENTS = 4000;

export function competitionRegistrationFeeCents(isPartner: boolean) {
  return isPartner
    ? PARTNER_COMP_REGISTRATION_FEE_CENTS
    : NON_PARTNER_COMP_REGISTRATION_FEE_CENTS;
}

export function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Current applications exclude retained withdrawal and removal history. */
export const currentApplicationWhere = {
  removedAt: null,
} satisfies Prisma.ApplicationWhereInput;

/** Removed applications and globally blocked teams are private to circuit ops. */
export const visibleApplicationWhere = {
  ...currentApplicationWhere,
  team: { applyBlocked: false },
} satisfies Prisma.ApplicationWhereInput;

/** Host and OneLegends payments are required for new AV slots. Preserve already
 * numbered historical rosters so an upgrade never hides existing scores. */
export const viewingEligibleApplicationWhere = {
  ...visibleApplicationWhere,
  team: {
    applyBlocked: false,
    registrationPaidAt: { not: null },
  },
  OR: [
    { viewingPosition: { not: null } },
    {
      compPaymentReceivedAt: { not: null },
      competition: { applications: { none: { viewingPosition: { not: null } } } },
    },
  ],
} satisfies Prisma.ApplicationWhereInput;

export function isViewingEligibleApplication(application: {
  removedAt: Date | null;
  viewingPosition: number | null;
  compPaymentReceivedAt: Date | null;
  team: { applyBlocked: boolean; registrationPaidAt: Date | null };
}, orderExists = false) {
  return (
    application.removedAt == null &&
    !application.team.applyBlocked &&
    application.team.registrationPaidAt != null &&
    (application.viewingPosition != null || (!orderExists && application.compPaymentReceivedAt != null))
  );
}
