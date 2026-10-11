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

/** Removed applications and globally blocked teams are private to circuit ops. */
export const visibleApplicationWhere = {
  removedAt: null,
  team: { applyBlocked: false },
} satisfies Prisma.ApplicationWhereInput;

/** Only paid teams may receive a Team number or an AV viewing slot. */
export const viewingEligibleApplicationWhere = {
  ...visibleApplicationWhere,
  team: {
    applyBlocked: false,
    registrationPaidAt: { not: null },
  },
} satisfies Prisma.ApplicationWhereInput;
