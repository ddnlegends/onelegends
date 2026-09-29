"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { saveTeamScores } from "@/app/actions/judge";
import {
  RUBRIC_CATEGORIES,
  isScoreComplete,
  rubricFilledCount,
  rubricTotal,
} from "@/lib/judging";
import { DriveAvPlayer } from "@/components/DriveAvPlayer";
import { SaveNotice } from "@/components/SaveNotice";

const SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => i);

type Saved = {
  choreography: number | null;
  formations: number | null;
  technique: number | null;
  syncCleanliness: number | null;
  overallImpression: number | null;
  comment?: string | null;
};

export function JudgeScoreForm({
  competitionId,
  assignmentId,
  position,
  totalTeams,
  avDriveUrl,
  saved,
  locked,
}: {
  competitionId: string;
  assignmentId: string;
  position: number;
  totalTeams: number;
  avDriveUrl: string;
  saved: Saved | null;
  locked: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(saveTeamScores, undefined);
  const prev = position > 1 ? position - 1 : null;
  const next = position < totalTeams ? position + 1 : null;
  const filled = rubricFilledCount(saved);
  const complete = isScoreComplete(saved);

  const [draftFilled, setDraftFilled] = useState(filled);

  function queueSave() {
    if (locked) return;
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    setDraftFilled(
      RUBRIC_CATEGORIES.filter(
        (category) => String(data.get(category.key) ?? "").trim() !== "",
      ).length,
    );
    form.requestSubmit();
  }

  return (
    <div className="space-y-6">
      <DriveAvPlayer
        url={avDriveUrl}
        label={`Team ${position} audition video`}
        scoringHint
      />

      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 rounded-xl border border-line bg-card"
      >
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="position" value={position} />
        <div className="rounded-t-xl bg-accent px-4 py-3 text-white">
          <p className="font-heading text-lg tracking-wide">Team {position}</p>
          <p className="text-xs uppercase tracking-widest text-white/80">
            Rubric · 0–10 whole numbers · Max 50 · Autosaves
          </p>
        </div>
        <div className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-5">
          {RUBRIC_CATEGORIES.map((category) => (
            <div key={category.key} className="field">
              <label htmlFor={category.key}>
                {category.label} ({category.max})
              </label>
              <select
                id={category.key}
                name={category.key}
                disabled={locked}
                defaultValue={saved?.[category.key] ?? ""}
                onChange={queueSave}
                onBlur={queueSave}
              >
                <option value="">—</option>
                {SCORE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="field px-4">
          <label htmlFor="comment">Comment for the competition</label>
          <textarea
            id="comment"
            name="comment"
            maxLength={1000}
            disabled={locked}
            defaultValue={saved?.comment ?? ""}
            placeholder="Optional. Invalid Drive link, video won’t play, wrong file, etc."
            onBlur={queueSave}
          />
          <p className="text-xs text-muted">
            The competition sees this after results unlock. Other judges never
            see it, and the team name stays hidden from you.
          </p>
        </div>
        <p className="px-4 text-sm text-muted">
          {complete && saved && draftFilled === 5
            ? `Saved total: ${rubricTotal(saved)} / 50. Scores autosave when you pick a number or leave a field.`
            : draftFilled
              ? `Autosaved ${draftFilled} / 5 categories. Fill the rest when you are ready.`
              : "Pick a score — it saves as soon as you choose it or click out."}
        </p>
        <div className="px-4">
          <SaveNotice
            state={state}
            fallbackOk={`Saved Team ${position}.`}
            refresh={false}
            scroll={false}
          />
          {pending ? <p className="text-xs text-muted">Saving…</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-4">
          {prev ? (
            <Link
              href={`/judge/${competitionId}/team/${prev}`}
              prefetch
              className="btn btn-ghost"
            >
              Team {prev}
            </Link>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Link href={`/judge/${competitionId}`} prefetch className="btn btn-ghost">
              Packet List
            </Link>
            {next ? (
              <Link
                href={`/judge/${competitionId}/team/${next}`}
                prefetch
                className="btn btn-ghost"
              >
                Team {next}
              </Link>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
