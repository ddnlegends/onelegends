/**
 * Optional applicant Google Sheet per competition, written with a service
 * account (`GOOGLE_SERVICE_ACCOUNT_*`).
 *
 * Server-only. `syncCompetitionSheet` refuses to run before results release,
 * because the sheet lists team names. It runs automatically at release and
 * when a competition changes an application status.
 */
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

const SHEET_HEADERS = [
  "Applied At",
  "Team Name",
  "AV Drive Link",
  "Wiki",
  "Photo",
  "Blurb",
  "Captains",
  "Years Established",
  "Roster Size",
  "AV Dancers",
  "Dietary Restrictions",
  "T-Shirt Sizes",
  "Status",
];

export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

export function parseSheetId(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const fromUrl = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-zA-Z0-9-_]+$/.test(value)) return value;
  return "";
}

let cachedClient: ReturnType<typeof google.sheets> | null = null;

/** One client per server instance, so its access token is reused between syncs. */
function getSheetsClient() {
  if (cachedClient) return cachedClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  if (!email || !key) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

function dietaryCell(
  dancers: { name: string; dietaryRestrictions: string }[],
): string {
  return dancers
    .filter((d) => d.dietaryRestrictions.trim())
    .map((d) => `${d.name}: ${d.dietaryRestrictions.trim()}`)
    .join("; ");
}

function tshirtCell(dancers: { name: string; tshirtSize: string }[]): string {
  return dancers
    .filter((d) => d.tshirtSize.trim())
    .map((d) => `${d.name}: ${d.tshirtSize.trim()}`)
    .join("; ");
}

export async function syncCompetitionSheet(
  competitionId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!sheetsConfigured()) {
    return {
      ok: false,
      message: "Google Sheets is not configured on this server.",
    };
  }

  // Most calls happen before release, so check the cheap gates before loading
  // every application, team, and dancer.
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: { resultsReleasedAt: true, googleSheetId: true, googleSheetUrl: true },
  });

  if (!competition) {
    return { ok: false, message: "Competition not found." };
  }
  if (!competition.resultsReleasedAt) {
    return {
      ok: false,
      message: "The applicant sheet fills in once results release and team identities unseal.",
    };
  }

  const sheetId = competition.googleSheetId || parseSheetId(competition.googleSheetUrl);
  if (!sheetId) {
    return {
      ok: false,
      message: "Add a Google Sheet URL or ID on your competition profile first.",
    };
  }

  const sheets = getSheetsClient();
  if (!sheets) {
    return { ok: false, message: "Could not create a Google Sheets client." };
  }

  const applications = await prisma.application.findMany({
    where: { competitionId },
    include: {
      team: { include: { dancers: { orderBy: { name: "asc" } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = applications.map((app) => {
    const avNames = app.team.dancers
      .filter((d) => d.inAV)
      .map((d) => d.name)
      .join(", ");
    return [
      app.createdAt.toISOString(),
      app.team.name,
      app.team.avDriveUrl,
      app.team.wikiUrl,
      app.team.photoUrl,
      app.team.blurb,
      app.team.captains,
      app.team.yearsEstablished?.toString() ?? "",
      (app.team.rosterSize ?? app.team.dancers.length).toString(),
      avNames,
      dietaryCell(app.team.dancers),
      tshirtCell(app.team.dancers),
      app.status,
    ];
  });

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: "A:M",
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "A1",
      valueInputOption: "RAW",
      requestBody: { values: [SHEET_HEADERS, ...rows] },
    });
    return {
      ok: true,
      message: `Synced ${rows.length} applicant${rows.length === 1 ? "" : "s"} to Google Sheets.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      message: `Sheet sync failed. Share the sheet with the service account as Editor. (${detail})`,
    };
  }
}
