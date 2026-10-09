import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminPage } from "@/lib/page-guards";
import { EXPORT_DATASETS } from "@/lib/ops-export";
import { ExportDownloadForm } from "@/components/ExportDownloadForm";

export default async function OpsExportPage({
  searchParams,
}: {
  searchParams: Promise<{ competitionId?: string }>;
}) {
  await requirePlatformAdminPage();
  const { competitionId } = await searchParams;
  const competitions = await prisma.competitionProfile.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const initialCompetitionId = competitions.some((c) => c.id === competitionId)
    ? (competitionId as string)
    : "";

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/dashboard" className="text-sm text-muted underline">
          Circuit ops
        </Link>
        <h1 className="font-heading text-4xl">Export data</h1>
        <p className="max-w-2xl text-muted">
          Download judging scores, results, lineups, rosters, competition
          details, and access lists. The .xlsx opens in spreadsheet apps with one
          tab per table (File → Import, or drop it into Drive). Team names in
          scores and results stay sealed as Team 1, Team 2, … until that
          competition’s results are released.
        </p>
      </div>

      <ExportDownloadForm
        competitions={competitions}
        datasets={EXPORT_DATASETS}
        initialCompetitionId={initialCompetitionId}
      />
    </div>
  );
}
