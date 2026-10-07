/**
 * Builds the tech-admin data exports served by `/api/ops/export`.
 *
 * Only call this after checking `platformAdmin`. Exports keep the anonymity
 * gate: before a competition releases results, scores show Team N instead of
 * names and lineups hide the viewing order. To add a dataset, add it to
 * `EXPORT_DATASETS` and `BUILDERS`; the page and route pick it up.
 */
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  COMP_STATUS_LABEL,
  RUBRIC_CATEGORIES,
  competitionStatus,
  isScoreComplete,
  rubricTotalOrNull,
  scoreComment,
  toPartialRubric,
} from "@/lib/judging";
import { rankTeams } from "@/lib/results";
import { avDancerNames, statusLabel } from "@/lib/utils";

export const EXPORT_DATASETS = [
  {
    key: "competitions",
    label: "Competition details",
    description: "Status, dates, venue, production notes, deadlines, and packet counts.",
  },
  {
    key: "lineups",
    label: "Competition lineups",
    description: "Every application with its status. Viewing order appears after results release.",
  },
  {
    key: "teams",
    label: "Team profiles",
    description: "Claim status, captains, roster size, links, and application blocks.",
  },
  {
    key: "rosters",
    label: "Rosters",
    description: "Every dancer with AV, dietary restrictions, and T-shirt size.",
  },
  {
    key: "judges",
    label: "Judges",
    description: "Judge requests, invitations, contact details, and packet progress.",
  },
  {
    key: "scores",
    label: "Full judging scores",
    description: "Every judge × team rubric score and comment. Teams stay numbered until release.",
  },
  {
    key: "results",
    label: "Results and rankings",
    description: "Rank, average z-score, and average total from submitted packets.",
  },
  {
    key: "access",
    label: "Accounts and access",
    description: "Tech admins, team and competition owners, Moderator access, and open invites.",
  },
] as const;

export type ExportDatasetKey = (typeof EXPORT_DATASETS)[number]["key"];

export type ExportCell = string | number;

export type ExportTable = {
  key: ExportDatasetKey;
  title: string;
  rows: ExportCell[][];
};

export function isExportDatasetKey(value: unknown): value is ExportDatasetKey {
  return EXPORT_DATASETS.some((dataset) => dataset.key === value);
}

function datasetLabel(key: ExportDatasetKey): string {
  return EXPORT_DATASETS.find((dataset) => dataset.key === key)?.label ?? key;
}

function stamp(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function num(value: number | null | undefined): ExportCell {
  return typeof value === "number" ? value : "";
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function teamLabel(position: number | null, name: string, released: boolean): string {
  if (released) return name;
  return position != null ? `Team ${position}` : "Team (unassigned)";
}

async function competitionsTable(competitionId?: string): Promise<ExportCell[][]> {
  const competitions = await prisma.competitionProfile.findMany({
    where: competitionId ? { id: competitionId } : undefined,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { applications: true } },
      judgeAssignments: {
        where: { status: "APPROVED" },
        select: { submittedAt: true },
      },
    },
  });
  return [
    [
      "Competition",
      "Type",
      "Status",
      "Claimed",
      "Dates",
      "Event date",
      "Location",
      "Venue",
      "Stage size",
      "Lighting",
      "Production notes",
      "Description",
      "Accepting applications",
      "Early application deadline",
      "Late application deadline",
      "Applications",
      "Judging open",
      "Approved judges",
      "Packets submitted",
      "Packets required",
      "Results released",
      "Applicant sheet",
      "Created",
    ],
    ...competitions.map((comp) => [
      comp.name,
      comp.isPartner ? "Partner" : "Non-partner",
      COMP_STATUS_LABEL[competitionStatus(comp)],
      yesNo(Boolean(comp.claimedAt || comp.userId)),
      comp.dates,
      stamp(comp.eventDate),
      comp.location,
      comp.venue,
      comp.stageSize,
      comp.lighting,
      comp.productionNotes,
      comp.description,
      yesNo(comp.acceptingApps),
      stamp(comp.earlyApplicationDeadline),
      stamp(comp.applicationDeadline),
      comp._count.applications,
      yesNo(comp.judgingOpen),
      comp.judgeAssignments.length,
      comp.judgeAssignments.filter((assignment) => assignment.submittedAt).length,
      comp.requiredJudgeCount,
      stamp(comp.resultsReleasedAt),
      comp.googleSheetUrl,
      stamp(comp.createdAt),
    ]),
  ];
}

async function lineupsTable(competitionId?: string): Promise<ExportCell[][]> {
  const applications = await prisma.application.findMany({
    where: competitionId ? { competitionId } : undefined,
    orderBy: [{ competition: { name: "asc" } }, { createdAt: "asc" }],
    include: {
      competition: { select: { name: true, resultsReleasedAt: true } },
      team: {
        include: { dancers: { select: { name: true, inAV: true } } },
      },
    },
  });
  return [
    [
      "Competition",
      "Team",
      "Application status",
      "Applied",
      "Viewing order",
      "Captains",
      "Roster size",
      "AV dancers",
      "AV link",
    ],
    ...applications.map((app) => [
      app.competition.name,
      app.team.name,
      statusLabel(app.status),
      stamp(app.createdAt),
      app.competition.resultsReleasedAt ? num(app.viewingPosition) : "Sealed until release",
      app.team.captains,
      app.team.rosterSize ?? app.team.dancers.length,
      avDancerNames(app.team.dancers),
      app.team.avDriveUrl,
    ]),
  ];
}

function teamScope(competitionId?: string) {
  return competitionId ? { applications: { some: { competitionId } } } : undefined;
}

async function teamsTable(competitionId?: string): Promise<ExportCell[][]> {
  const teams = await prisma.teamProfile.findMany({
    where: teamScope(competitionId),
    orderBy: { name: "asc" },
    include: {
      _count: { select: { dancers: true, applications: true } },
      memberships: {
        where: { status: "APPROVED" },
        include: { user: { select: { email: true } } },
      },
    },
  });
  return [
    [
      "Team",
      "Claimed",
      "Claim code",
      "Owners and admins",
      "Captains",
      "Years established",
      "Roster size",
      "Dancers listed",
      "Applications",
      "Blocked from applying",
      "Block reason",
      "Wiki",
      "AV link",
      "Blurb",
      "Created",
    ],
    ...teams.map((team) => [
      team.name,
      yesNo(Boolean(team.claimedAt)),
      team.claimCode,
      team.memberships
        .map((membership) => `${membership.user.email}${membership.isPrimary ? " (primary)" : ""}`)
        .join(", "),
      team.captains,
      num(team.yearsEstablished),
      team.rosterSize ?? team._count.dancers,
      team._count.dancers,
      team._count.applications,
      yesNo(team.applyBlocked),
      team.applyBlockReason,
      team.wikiUrl,
      team.avDriveUrl,
      team.blurb,
      stamp(team.createdAt),
    ]),
  ];
}

async function rostersTable(competitionId?: string): Promise<ExportCell[][]> {
  const dancers = await prisma.dancer.findMany({
    where: competitionId ? { team: teamScope(competitionId) } : undefined,
    orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
    include: { team: { select: { name: true } } },
  });
  return [
    ["Team", "Dancer", "In AV", "Dietary restrictions", "T-shirt size"],
    ...dancers.map((dancer) => [
      dancer.team.name,
      dancer.name,
      yesNo(dancer.inAV),
      dancer.dietaryRestrictions,
      dancer.tshirtSize,
    ]),
  ];
}

async function judgesTable(competitionId?: string): Promise<ExportCell[][]> {
  const [assignments, invites] = await Promise.all([
    prisma.judgeAssignment.findMany({
      where: competitionId ? { competitionId } : undefined,
      orderBy: [{ competition: { name: "asc" } }, { requestedAt: "asc" }],
      include: {
        competition: { select: { name: true } },
        judge: { include: { user: { select: { email: true } } } },
        slots: { include: { score: true } },
      },
    }),
    prisma.judgeInvite.findMany({
      where: competitionId ? { competitionId } : undefined,
      orderBy: [{ competition: { name: "asc" } }, { createdAt: "asc" }],
      include: { competition: { select: { name: true } } },
    }),
  ]);
  return [
    [
      "Competition",
      "Judge",
      "Email",
      "Phone",
      "Status",
      "Requested",
      "Decided",
      "Teams fully scored",
      "Teams in packet",
      "Packet submitted",
    ],
    ...assignments.map((assignment) => [
      assignment.competition.name,
      assignment.judge.name,
      assignment.judge.user.email,
      assignment.judge.phone,
      assignment.status === "APPROVED"
        ? "Approved"
        : assignment.status === "DENIED"
          ? "Denied"
          : "Pending",
      stamp(assignment.requestedAt),
      stamp(assignment.decidedAt),
      assignment.slots.filter((slot) => isScoreComplete(toPartialRubric(slot.score))).length,
      assignment.slots.length,
      stamp(assignment.submittedAt),
    ]),
    ...invites.map((invite) => [
      invite.competition.name,
      "",
      invite.email,
      "",
      "Invited (no account yet)",
      stamp(invite.createdAt),
      "",
      "",
      "",
      "",
    ]),
  ];
}

async function scoresTable(competitionId?: string): Promise<ExportCell[][]> {
  const slots = await prisma.judgeViewingSlot.findMany({
    where: {
      assignment: {
        status: "APPROVED",
        ...(competitionId ? { competitionId } : {}),
      },
    },
    orderBy: [
      { assignment: { competition: { name: "asc" } } },
      { assignment: { judge: { name: "asc" } } },
      { position: "asc" },
    ],
    include: {
      score: true,
      application: { include: { team: { select: { name: true } } } },
      assignment: {
        include: {
          competition: { select: { name: true, resultsReleasedAt: true } },
          judge: { select: { name: true } },
        },
      },
    },
  });
  return [
    [
      "Competition",
      "Judge",
      "Packet submitted",
      "Team #",
      "Team",
      ...RUBRIC_CATEGORIES.map((category) => `${category.label} (/${category.max})`),
      "Total (/50)",
      "Complete",
      "Comment",
      "Last updated",
    ],
    ...slots.map((slot) => {
      const released = Boolean(slot.assignment.competition.resultsReleasedAt);
      const rubric = toPartialRubric(slot.score);
      return [
        slot.assignment.competition.name,
        slot.assignment.judge.name,
        stamp(slot.assignment.submittedAt),
        slot.position,
        teamLabel(slot.position, slot.application.team.name, released),
        ...RUBRIC_CATEGORIES.map((category) => num(rubric?.[category.key])),
        num(rubricTotalOrNull(rubric)),
        yesNo(isScoreComplete(rubric)),
        scoreComment(slot.score),
        stamp(slot.score?.updatedAt),
      ];
    }),
  ];
}

async function resultsTable(competitionId?: string): Promise<ExportCell[][]> {
  const competitions = await prisma.competitionProfile.findMany({
    where: competitionId ? { id: competitionId } : undefined,
    orderBy: { name: "asc" },
    select: {
      name: true,
      resultsReleasedAt: true,
      requiredJudgeCount: true,
      applications: {
        select: {
          id: true,
          teamId: true,
          status: true,
          viewingPosition: true,
          team: { select: { name: true } },
        },
      },
      judgeAssignments: {
        where: { status: "APPROVED", submittedAt: { not: null } },
        select: {
          judge: { select: { name: true } },
          slots: { select: { applicationId: true, score: true } },
        },
      },
    },
  });

  const rows: ExportCell[][] = [];
  for (const comp of competitions) {
    if (comp.judgeAssignments.length === 0) continue;
    const released = Boolean(comp.resultsReleasedAt);
    const ranked = rankTeams(comp.applications, comp.judgeAssignments);
    ranked.forEach((team, index) => {
      rows.push([
        comp.name,
        released ? "Released" : "Provisional (not released)",
        index + 1,
        num(team.viewingPosition),
        teamLabel(team.viewingPosition, team.name, released),
        released ? statusLabel(team.status) : "",
        team.judges.length,
        `${comp.judgeAssignments.length} / ${comp.requiredJudgeCount}`,
        round(team.avgZ),
        round(team.avgTotal, 2),
        team.judges.map((judge) => `${judge.judgeName}: ${judge.total}`).join("; "),
      ]);
    });
  }

  return [
    [
      "Competition",
      "Results",
      "Rank",
      "Team #",
      "Team",
      "Application status",
      "Judges who scored",
      "Packets submitted",
      "Average z-score",
      "Average total (/50)",
      "Judge totals",
    ],
    ...rows,
  ];
}

async function accessTable(competitionId?: string): Promise<ExportCell[][]> {
  const compWhere = competitionId ? { competitionId } : undefined;
  const [
    techAdmins,
    techInvites,
    teamMemberships,
    teamInvites,
    compMemberships,
    compInvites,
    moderatorAccess,
    moderatorInvites,
  ] = await Promise.all([
    competitionId
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { platformAdmin: true },
          select: { email: true, name: true, createdAt: true },
          orderBy: { email: "asc" },
        }),
    competitionId
      ? Promise.resolve([])
      : prisma.platformAdminInvite.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.teamMembership.findMany({
      where: competitionId ? { team: teamScope(competitionId) } : undefined,
      orderBy: [{ team: { name: "asc" } }, { createdAt: "asc" }],
      include: { team: { select: { name: true } }, user: { select: { email: true, name: true } } },
    }),
    prisma.teamInvite.findMany({
      where: competitionId ? { team: teamScope(competitionId) } : undefined,
      orderBy: [{ team: { name: "asc" } }, { createdAt: "asc" }],
      include: { team: { select: { name: true } } },
    }),
    prisma.competitionMembership.findMany({
      where: compWhere,
      orderBy: [{ competition: { name: "asc" } }, { createdAt: "asc" }],
      include: {
        competition: { select: { name: true } },
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.compInvite.findMany({
      where: compWhere,
      orderBy: [{ competition: { name: "asc" } }, { createdAt: "asc" }],
      include: { competition: { select: { name: true } } },
    }),
    prisma.moderatorAccess.findMany({
      where: compWhere,
      orderBy: [{ competition: { name: "asc" } }, { createdAt: "asc" }],
      include: {
        competition: { select: { name: true } },
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.moderatorInvite.findMany({
      where: compWhere,
      orderBy: [{ competition: { name: "asc" } }, { createdAt: "asc" }],
      include: { competition: { select: { name: true } } },
    }),
  ]);

  const membershipRole = (m: { isPrimary: boolean; isAdmin: boolean }) =>
    m.isPrimary ? "Primary owner" : m.isAdmin ? "Admin" : "Member";
  const membershipStatus = (status: string) =>
    status === "APPROVED" ? "Active" : status === "DENIED" ? "Denied" : "Waiting to approve";

  return [
    ["Access type", "Team or competition", "Email", "Name", "Role", "Status", "Since"],
    ...techAdmins.map((admin) => [
      "Tech admin",
      "Circuit",
      admin.email,
      admin.name,
      "Tech admin",
      "Active",
      stamp(admin.createdAt),
    ]),
    ...techInvites.map((invite) => [
      "Tech admin",
      "Circuit",
      invite.email,
      "",
      "Tech admin",
      "Invited (no account yet)",
      stamp(invite.createdAt),
    ]),
    ...teamMemberships.map((m) => [
      "Team",
      m.team.name,
      m.user.email,
      m.user.name,
      membershipRole(m),
      membershipStatus(m.status),
      stamp(m.createdAt),
    ]),
    ...teamInvites.map((invite) => [
      "Team",
      invite.team.name,
      invite.email,
      "",
      "Admin",
      "Invited (no account yet)",
      stamp(invite.createdAt),
    ]),
    ...compMemberships.map((m) => [
      "Competition",
      m.competition.name,
      m.user.email,
      m.user.name,
      membershipRole(m),
      membershipStatus(m.status),
      stamp(m.createdAt),
    ]),
    ...compInvites.map((invite) => [
      "Competition",
      invite.competition.name,
      invite.email,
      "",
      "Admin",
      "Invited (no account yet)",
      stamp(invite.createdAt),
    ]),
    ...moderatorAccess.map((row) => [
      "Moderator",
      row.competition.name,
      row.user.email,
      row.user.name,
      "Moderator",
      "Active",
      stamp(row.createdAt),
    ]),
    ...moderatorInvites.map((invite) => [
      "Moderator",
      invite.competition.name,
      invite.email,
      "",
      "Moderator",
      "Invited (no account yet)",
      stamp(invite.createdAt),
    ]),
  ];
}

const BUILDERS: Record<ExportDatasetKey, (competitionId?: string) => Promise<ExportCell[][]>> = {
  competitions: competitionsTable,
  lineups: lineupsTable,
  teams: teamsTable,
  rosters: rostersTable,
  judges: judgesTable,
  scores: scoresTable,
  results: resultsTable,
  access: accessTable,
};

export async function buildExportTables(
  datasets: ExportDatasetKey[],
  competitionId?: string,
): Promise<ExportTable[]> {
  return Promise.all(
    datasets.map(async (key) => ({
      key,
      title: datasetLabel(key),
      rows: await BUILDERS[key](competitionId),
    })),
  );
}

/** Each table becomes one worksheet; Excel caps tab names at 31 characters. */
export async function toXlsx(tables: ExportTable[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OneLegends";
  workbook.created = new Date();

  for (const table of tables) {
    const sheet = workbook.addWorksheet(table.title.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.addRows(table.rows);
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8E1C42" } };
    const columns = table.rows[0]?.length ?? 0;
    if (columns > 0) {
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns } };
    }
    for (let index = 0; index < columns; index += 1) {
      const longest = table.rows.reduce(
        (max, row) => Math.max(max, String(row[index] ?? "").length),
        0,
      );
      sheet.getColumn(index + 1).width = Math.min(Math.max(longest, 8), 50) + 2;
    }
  }

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** Formula-looking cells are prefixed so a team name like "=HYPERLINK(...)" stays text. */
function csvCell(value: ExportCell): string {
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: ExportCell[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
