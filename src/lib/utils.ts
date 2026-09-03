import { ApplicationStatus } from "@prisma/client";

export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function statusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "ACCEPTED":
      return "Accepted";
    case "WAITLISTED":
      return "Waitlisted";
    case "DECLINED":
      return "Declined";
    default:
      return status;
  }
}

export function avDancerNames(
  dancers: { name: string; inAV: boolean }[],
): string {
  return dancers
    .filter((d) => d.inAV)
    .map((d) => d.name)
    .join(", ");
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
