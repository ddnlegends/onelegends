"use client";

/**
 * One judge's rubric sheet for one anonymous team. Scores save the moment a
 * number is picked; comments save after a short pause, on blur, and when the
 * sheet unmounts (for example when it follows Moderator to the next team). All saves
 * for a sheet go through one ordered queue so an older save never overwrites a
 * newer one. The form never receives a team name.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveTeamScores } from "@/app/actions/judge";
import {
  RUBRIC_CATEGORIES,
  isScoreComplete,
  rubricTotal,
  type RubricKey,
} from "@/lib/judging-rules";
import { SaveNotice } from "@/components/SaveNotice";

const SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => i);
const COMMENT_SAVE_DELAY_MS = 800;

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

type SaveState = Awaited<ReturnType<typeof saveTeamScores>> | undefined;

/**
 * Each save writes every field, so saves for one sheet must land in order.
 * The queue lives at module scope so an unmount flush still waits its turn.
 */
const saveQueues = new Map<string, Promise<unknown>>();

function queueKey(assignmentId: string, position: number): string {
  return `${assignmentId}:${position}`;
}

function enqueueSave(key: string, data: FormData): Promise<SaveState> {
  const previous = saveQueues.get(key) ?? Promise.resolve();
  const next = previous.then(
    () => saveTeamScores(undefined, data),
    () => saveTeamScores(undefined, data),
  );
  const result = next.catch(() => ({
    error: "Could not save. Check your connection and pick the score again.",
  }));
  saveQueues.set(key, result);
  void result.then(() => {
    if (saveQueues.get(key) === result) saveQueues.delete(key);
  });
  return result;
}

function filledFromDraft(draft: Draft): number {
  return RUBRIC_CATEGORIES.filter((category) => draft[category.key] !== "")
    .length;
}

export function JudgeScoreForm({
  competitionId,
  assignmentId,
  position,
  prevPosition,
  nextPosition,
  saved,
  locked,
}: {
  competitionId: string;
  assignmentId: string;
  position: number;
  prevPosition: number | null;
  nextPosition: number | null;
  saved: Saved | null;
  locked: boolean;
}) {
  const [state, setState] = useState<SaveState>(undefined);
  const [inFlight, setInFlight] = useState(0);
  const pending = inFlight > 0;
  const [draft, setDraft] = useState(() => toDraft(saved));
  const commentTimer = useRef<number | null>(null);
  const pendingComment = useRef<Draft | null>(null);
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

  function toFormData(draftToSave: Draft) {
    const data = new FormData();
    data.set("assignmentId", assignmentId);
    data.set("position", String(position));
    data.set("comment", draftToSave.comment);
    for (const category of RUBRIC_CATEGORIES) {
      data.set(category.key, draftToSave[category.key]);
    }
    return data;
  }

  function persist(draftToSave: Draft) {
    if (locked) return;
    if (commentTimer.current != null) {
      window.clearTimeout(commentTimer.current);
      commentTimer.current = null;
    }
    pendingComment.current = null;
    setInFlight((n) => n + 1);
    void enqueueSave(queueKey(assignmentId, position), toFormData(draftToSave)).then(
      (result) => {
        setState(result);
        setInFlight((n) => n - 1);
      },
    );
  }

  useEffect(() => {
    return () => {
      if (commentTimer.current != null) {
        window.clearTimeout(commentTimer.current);
      }
      const unsaved = pendingComment.current;
      if (unsaved && !locked) {
        // The sheet can unmount when it follows the live team; queue the last
        // typed comment behind earlier saves instead of dropping it.
        void enqueueSave(queueKey(assignmentId, position), toFormData(unsaved));
      }
    };
    // toFormData only reads props that are fixed for this keyed instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  function updateScore(key: RubricKey, value: string) {
    const draftToSave = { ...draft, [key]: value };
    setDraft(draftToSave);
    persist(draftToSave);
  }

  function updateComment(value: string) {
    const draftToSave = { ...draft, comment: value };
    setDraft(draftToSave);
    if (locked) return;
    pendingComment.current = draftToSave;
    if (commentTimer.current != null) window.clearTimeout(commentTimer.current);
    commentTimer.current = window.setTimeout(() => {
      commentTimer.current = null;
      if (pendingComment.current) persist(pendingComment.current);
    }, COMMENT_SAVE_DELAY_MS);
  }

  function flushComment() {
    if (pendingComment.current) persist(pendingComment.current);
  }

  return (
    <form className="space-y-4 rounded-xl border border-line bg-card">
      <div className="rounded-t-xl bg-brand px-4 py-3 text-white">
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
              onChange={(event) => updateScore(category.key, event.target.value)}
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
          placeholder="Optional. Audio issues, wrong video on screen, etc."
          onChange={(event) => updateComment(event.target.value)}
          onBlur={flushComment}
        />
        <p className="text-xs text-muted">
          The competition sees this after results unlock. Other judges never see
          it, and the team name stays hidden from you.
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
            })} / 50. Scores autosave as soon as you pick a number.`
          : filled
            ? `Autosaved ${filled} / 5 categories. Comments are optional.`
            : "Pick a score. It saves as soon as you choose it."}
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
        {prevPosition ? (
          <Link
            href={`/judge/${competitionId}/team/${prevPosition}?stay=1`}
            prefetch
            className="btn btn-ghost"
          >
            Team {prevPosition}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Link href={`/judge/${competitionId}`} prefetch className="btn btn-ghost">
            Packet List
          </Link>
          {nextPosition ? (
            <Link
              href={`/judge/${competitionId}/team/${nextPosition}?stay=1`}
              prefetch
              className="btn btn-ghost"
            >
              Team {nextPosition}
            </Link>
          ) : null}
        </div>
      </div>
    </form>
  );
}
