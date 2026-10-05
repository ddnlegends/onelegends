import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/team-access";
import {
  buildExportTables,
  isExportDatasetKey,
  toCsv,
  toXlsx,
} from "@/lib/ops-export";

function fileSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!(await isPlatformAdmin(userId))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const datasets = [...new Set(params.getAll("dataset"))].filter(isExportDatasetKey);
  if (datasets.length === 0) {
    return NextResponse.json({ error: "Pick at least one export." }, { status: 400 });
  }
  const format = params.get("format") === "csv" ? "csv" : "xlsx";
  if (format === "csv" && datasets.length > 1) {
    return NextResponse.json(
      { error: "CSV holds one table. Download .xlsx for several." },
      { status: 400 },
    );
  }

  const competitionId = params.get("competitionId") || undefined;
  let scope = "all-competitions";
  if (competitionId) {
    const competition = await prisma.competitionProfile.findUnique({
      where: { id: competitionId },
      select: { name: true },
    });
    if (!competition) {
      return NextResponse.json({ error: "Competition not found." }, { status: 404 });
    }
    scope = fileSlug(competition.name) || "competition";
  }

  const tables = await buildExportTables(datasets, competitionId);
  const date = new Date().toISOString().slice(0, 10);
  const subject = datasets.length === 1 ? datasets[0] : "export";
  const filename = `onelegends-${subject}-${scope}-${date}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  if (format === "csv") {
    return new NextResponse(`\uFEFF${toCsv(tables[0].rows)}`, {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  return new NextResponse(await toXlsx(tables), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
