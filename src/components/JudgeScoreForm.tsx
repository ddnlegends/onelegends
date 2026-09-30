"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { saveTeamScores } from "@/app/actions/judge";
import {
  RUBRIC_CATEGORIES,
  isScoreComplete,
  rubricTotal,
  type RubricKey,
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

type Draft = Record<RubricKey, string> & { comment: string };

function toDraft(saved: Saved | null): Draft {
  return {
    choreography: saved?.choreography == null ? "" : String(saved.choreography),
    formations: saved?.formations == null ? "" : String(saved.formations),
    technique: saved?.technique == null ? "" : String(saved.technique),
    syncCleanliness:
      saved?.syncCleanliness == null ? "" : String(saved.syncCleanliness),
    overallImpression:
      saved?.overallImpression == null ? "" : String(saved.overallImpression),
    comment: saved?.comment ?? "",
  };
}

function filledFromDraft(draft: Draft): number {
  return RUBRIC_CATEGORIES.filter((category) => draft[category.key] !== "")
    .length;
}

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
  const [state, formAction, pending] = useActionState(saveTeamScores, undefined);
  const [draft, setDraft] = useState(() => toDraft(saved));
  const prev = position > 1 ? position - 1 : null;
  const next = position < totalTeams ? position + 1 : null;
  const filled = filledFromDraft(draft);
  const complete = isScoreComplete({
    choreography: draft.choreography === "" ? null : Number(draft.choreography),
    formations: draft.formations === "" ? null : Number(draft.formations),
    technique: draft.technique === "" ? null : Number(draft.technique),
    syncCleanliness:
      draft.syncCleanliness === "" ? null : Number(draft.syncCleanliness),
    overallImpression:
      draft.overallImpression === "" ? null : Number(draft.overallImpression),
  });

  function persist(draftToSave: Draft) {
    if (locked) return;
    const data = new FormData();
    data.set("assignmentId", assignmentId);
    data.set("position", String(position));
    data.set("comment", draftToSave.comment);
    for (const category of RUBRIC_CATEGORIES) {
      if (draftToSave[category.key] !== "") {
        data.set(category.key, draftToSave[category.key]);
      }
    }
    startTransition(() => {
      formAction(data);
    });
  }

  function updateScore(key: RubricKey, value: string) {
    const draftToSave = { ...draft, [key]: value };
    setDraft(draftToSave);
    persist(draftToSave);
  }

  function updateComment(value: string) {
    const draftToSave = { ...draft, comment: value };
    setDraft(draftToSave);
    persist(draftToSave);
  }

  return (
    <div className="space-y-6">
      <DriveAvPlayer
        url={avDriveUrl}
        label={`Team ${position} audition video`}
        scoringHint
      />

      <form className="space-y-4 rounded-xl border border-line bg-card">
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
                disabled={locked}
                value={draft[category.key]}
                onChange={(event) =>
                  updateScore(category.key, event.target.value)
                }
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
            maxLength={1000}
            disabled={locked}
            value={draft.comment}
            placeholder="Optional. Invalid Drive link, video won’t play, wrong file, etc."
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                comment: event.target.value,
              }))
            }
            onBlur={(event) => updateComment(event.target.value)}
          />
          <p className="text-xs text-muted">
            The competition sees this after results unlock. Other judges never
            see it, and the team name stays hidden from you.
          </p>
        </div>
        <p className="px-4 text-sm text-muted">
          {complete
            ? `Saved total: ${rubricTotal({
                choreography: Number(draft.choreography),
                formations: Number(draft.formations),
                technique: Number(draft.technique),
                syncCleanliness: Number(draft.syncCleanliness),
                overallImpression: Number(draft.overallImpression),
              })} / 50. Scores autosave when you pick a number or leave a field.`
            : filled
              ? `Autosaved ${filled} / 5 categories. Fill all five to go to the next team. Comments are optional.`
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
              complete || locked ? (
                <Link
                  href={`/judge/${competitionId}/team/${next}`}
                  prefetch
                  className="btn btn-ghost"
                >
                  Team {next}
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled
                  title="Fill all five rubric scores first. Comments are optional."
                >
                  Team {next}
                </button>
              )
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
