export type SeasonComp = {
  slug: string;
  name: string;
  claimCode: string;
  eventDate: Date;
  dates: string;
  location: string;
  venue: string;
  acceptingApps?: boolean;
};

/** Official bid listings. Codes are also listed in local docs/CREDENTIALS.md — treat them as secrets. */
export const SEASON_COMPS: SeasonComp[] = [
  {
    slug: "legends",
    name: "Legends",
    claimCode: "LGND-7K2M",
    eventDate: new Date("2026-04-18"),
    dates: "Apr 18, 2026",
    location: "Austin, TX",
    venue: "TBA",
  },
  {
    slug: "buckeye-mela",
    name: "Buckeye Mela",
    claimCode: "BCKY-1N4R",
    eventDate: new Date("2026-01-24"),
    dates: "Jan 24, 2026",
    location: "Columbus, OH",
    venue: "TBA",
  },
  {
    slug: "atl-tamasha",
    name: "ATL Tamasha",
    claimCode: "ATL-6J7K",
    eventDate: new Date("2025-11-22"),
    dates: "Nov 22, 2025",
    location: "Atlanta, GA",
    venue: "TBA",
    acceptingApps: false,
  },
];
