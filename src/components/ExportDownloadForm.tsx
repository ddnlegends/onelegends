"use client";

import { useState } from "react";
import type { ExportDatasetKey } from "@/lib/ops-export";

type Dataset = { key: ExportDatasetKey; label: string; description: string };

const JUDGING_PACK: ExportDatasetKey[] = ["lineups", "judges", "scores", "results"];

export function ExportDownloadForm({
  competitions,
  datasets,
  initialCompetitionId,
}: {
  competitions: { id: string; name: string }[];
  datasets: readonly Dataset[];
  initialCompetitionId: string;
}) {
  const [competitionId, setCompetitionId] = useState(initialCompetitionId);
  const [selected, setSelected] = useState<Set<ExportDatasetKey>>(
    () => new Set(datasets.map((dataset) => dataset.key)),
  );

  const allKeys = datasets.map((dataset) => dataset.key);
  const toggle = (key: ExportDatasetKey) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const csvHref = (key: ExportDatasetKey) => {
    const params = new URLSearchParams({ format: "csv", dataset: key });
    if (competitionId) params.set("competitionId", competitionId);
    return `/api/ops/export?${params}`;
  };
  const presets: { label: string; keys: ExportDatasetKey[] }[] = [
    { label: "Everything", keys: allKeys },
    { label: "Judging pack", keys: JUDGING_PACK },
    { label: "Clear", keys: [] },
  ];

  return (
    <form method="get" action="/api/ops/export" className="space-y-6">
      <input type="hidden" name="format" value="xlsx" />

      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-card p-6">
        <div className="field min-w-64 flex-1">
          <label htmlFor="competitionId">Competition</label>
          <select
            id="competitionId"
            name="competitionId"
            value={competitionId}
            onChange={(event) => setCompetitionId(event.target.value)}
          >
            <option value="">All competitions</option>
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn btn-ghost py-1.5 text-sm"
              onClick={() => setSelected(new Set(preset.keys))}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {datasets.map((dataset) => {
          const checked = selected.has(dataset.key);
          return (
            <li
              key={dataset.key}
              className={`flex items-start justify-between gap-3 rounded-xl border bg-card p-4 transition ${
                checked ? "border-accent/50 shadow-sm" : "border-line"
              }`}
            >
              <label className="flex flex-1 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="dataset"
                  value={dataset.key}
                  checked={checked}
                  onChange={() => toggle(dataset.key)}
                  className="mt-1 size-4 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="block font-semibold">{dataset.label}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {dataset.description}
                  </span>
                </span>
              </label>
              <a
                href={csvHref(dataset.key)}
                className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-muted transition hover:border-accent/50 hover:text-accent"
                title={`Download ${dataset.label} as CSV`}
              >
                CSV
              </a>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card/95 p-4 shadow-md backdrop-blur">
        <p className="text-sm text-muted">
          {selected.size === 0
            ? "Pick at least one table."
            : `${selected.size} table${selected.size === 1 ? "" : "s"} → one workbook, one tab each`}
        </p>
        <button type="submit" className="btn btn-primary" disabled={selected.size === 0}>
          Download .xlsx
        </button>
      </div>
    </form>
  );
}
