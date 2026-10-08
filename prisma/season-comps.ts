export type SeasonComp = {
  slug: string;
  name: string;
  eventDate: Date;
  dates: string;
  location: string;
  venue: string;
  acceptingApps?: boolean;
};

/** Listing metadata only. Seed generates fresh claim codes in a disposable database. */
export const SEASON_COMPS: SeasonComp[] = [
  {
    slug: "legends",
    name: "Legends",
    eventDate: new Date("2026-04-18"),
    dates: "Apr 18, 2026",
    location: "Austin, TX",
    venue: "TBA",
  },
  {
    slug: "buckeye-mela",
    name: "Buckeye Mela",
    eventDate: new Date("2026-01-24"),
    dates: "Jan 24, 2026",
    location: "Columbus, OH",
    venue: "TBA",
  },
  {
    slug: "atl-tamasha",
    name: "ATL Tamasha",
    eventDate: new Date("2025-11-22"),
    dates: "Nov 22, 2025",
    location: "Atlanta, GA",
    venue: "TBA",
    acceptingApps: false,
  },
];
