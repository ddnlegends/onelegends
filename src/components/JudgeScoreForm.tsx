"use client";

/** One judge's rubric sheet for one anonymous team. */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveTeamScores } from "@/app/actions/judge";
import {
  RUBRIC_CATEGORIES,
  isScoreComplete,
  rubricTotal,
  type RubricKey,
} from "@/lib/judging-rules";
const SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => i);
const AUTOSAVE_DELAY_MS = 1500;

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
type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

function sameDraft(a: Draft, b: Draft): boolean {
  return a.comment === b.comment &&
    RUBRIC_CATEGORIES.every((category) => a[category.key] === b[category.key]);
}

function completeDraft(draft: Draft): boolean {
  return isScoreComplete(Object.fromEntries(
    RUBRIC_CATEGORIES.map(({ key }) => [key, draft[key] === "" ? null : Number(draft[key])]),
  ) as Record<RubricKey, number | null>);
}

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
  scoreAvailable,
  livePosition,
  onDirtyChange,
}: {
  competitionId: string;
  assignmentId: string;
  position: number;
  prevPosition: number | null;
  nextPosition: number | null;
  saved: Saved | null;
  locked: boolean;
  scoreAvailable: boolean;
  livePosition: number | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<SaveState>(undefined);
  const [draft, setDraft] = useState(() => toDraft(saved));
  const draftRef = useRef(draft);
  const lastSavedRef = useRef(toDraft(saved));
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(saved ? "saved" : "idle");
  const [scoreSaved, setScoreSaved] = useState(() => isScoreComplete(saved));
  const filled = filledFromDraft(draft);
  const scoreLocked = locked || !scoreAvailable;
  const commentLocked = locked || (scoreLocked && filled === 0 && !saved);
  const complete = completeDraft(draft);

  const toFormData = useCallback((draftToSave: Draft, mode: "score" | "comment") => {
    const data = new FormData();
    data.set("assignmentId", assignmentId);
    data.set("position", String(position));
    data.set("mode", mode);
    data.set("comment", draftToSave.comment);
    for (const category of RUBRIC_CATEGORIES) {
      data.set(category.key, draftToSave[category.key]);
    }
    return data;
  }, [assignmentId, position]);

  const saveLatest = useCallback(async (flushAll = false): Promise<boolean> => {
    while (true) {
      while (saveInFlightRef.current) await saveInFlightRef.current;
      const snapshot = draftRef.current;
      if (sameDraft(snapshot, lastSavedRef.current)) return true;
      if (scoreLocked && commentLocked) return false;
      // A paused moderator still allows comments on an existing sheet. The
      // server's comment mode preserves its scores in that case.
      const scoresChanged = RUBRIC_CATEGORIES.some(
        ({ key }) => snapshot[key] !== lastSavedRef.current[key],
      );
      if (scoreLocked && scoresChanged) {
        setState({ error: "Scoring is paused. Wait for the moderator to resume before saving these scores." });
        setSaveStatus("error");
        return false;
      }
      const mode = scoresChanged ? "score" : "comment";
      setSaveStatus("saving");
      const task = enqueueSave(
        queueKey(assignmentId, position),
        toFormData(snapshot, mode),
      ).then((result) => {
        setState(result);
        if (result?.ok) {
          lastSavedRef.current = snapshot;
          if (mode === "score") setScoreSaved(completeDraft(snapshot));
          const currentSaved = sameDraft(draftRef.current, snapshot);
          setSaveStatus(currentSaved ? "saved" : "unsaved");
          onDirtyChange?.(!currentSaved);
          return true;
        }
        setSaveStatus("error");
        return false;
      });
      saveInFlightRef.current = task;
      let ok: boolean;
      try {
        ok = await task;
      } finally {
        if (saveInFlightRef.current === task) saveInFlightRef.current = null;
      }
      if (!ok || !flushAll || sameDraft(draftRef.current, lastSavedRef.current)) return ok;
    }
  }, [assignmentId, position, scoreLocked, commentLocked, toFormData, onDirtyChange]);

  useEffect(() => {
    if (saveStatus !== "unsaved" || sameDraft(draft, lastSavedRef.current) || scoreLocked && commentLocked) return;
    const timer = window.setTimeout(() => { void saveLatest(); }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, saveLatest, scoreLocked, commentLocked, saveStatus]);

  // Client-side navigation can unmount the sheet as the moderator advances.
  // Flush its last edit even when the debounce timer has not fired yet.
  const saveLatestRef = useRef(saveLatest);
  useEffect(() => { saveLatestRef.current = saveLatest; }, [saveLatest]);
  useEffect(() => () => { void saveLatestRef.current(true); }, []);

  useEffect(() => {
    if (saveStatus !== "unsaved" && saveStatus !== "saving" && saveStatus !== "error") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus]);

  const dirty = saveStatus === "unsaved" || saveStatus === "saving" || saveStatus === "error";
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  function navigateAfterSave(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!dirty) return;
    event.preventDefault();
    void saveLatest(true).then((ok) => { if (ok) router.push(href); });
  }

  function updateScore(key: RubricKey, value: string) {
    if (scoreLocked) return;
    const next = { ...draftRef.current, [key]: value };
    draftRef.current = next;
    setDraft(next);
    setState(undefined);
    const dirtyNow = !sameDraft(next, lastSavedRef.current) || Boolean(saveInFlightRef.current);
    setSaveStatus(dirtyNow ? "unsaved" : "saved");
    onDirtyChange?.(dirtyNow);
  }

  function updateComment(value: string) {
    if (commentLocked) return;
    const next = { ...draftRef.current, comment: value };
    draftRef.current = next;
    setDraft(next);
    setState(undefined);
    const dirtyNow = !sameDraft(next, lastSavedRef.current) || Boolean(saveInFlightRef.current);
    setSaveStatus(dirtyNow ? "unsaved" : "saved");
    onDirtyChange?.(dirtyNow);
  }

  return (
    <form className="space-y-4 rounded-xl border border-line bg-card">
      <div className="rounded-t-xl bg-brand px-4 py-3 text-white">
        <p className="font-heading text-lg tracking-wide">Team {position}</p>
        <p className="text-xs uppercase tracking-widest text-white/80">
          Rubric · 0–10 whole numbers · Max 50 · Saves automatically
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
              disabled={scoreLocked}
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
        <label htmlFor="comment">Comments on this team’s video</label>
        <textarea
          id="comment"
          maxLength={1000}
          disabled={commentLocked}
          value={draft.comment}
          placeholder="Optional. Audio issues, wrong video on screen, etc."
          onChange={(event) => updateComment(event.target.value)}
        />
        <p className="text-xs text-muted">
          The competition sees this after results unlock. Other judges never see
          it, and the team name stays hidden from you.
        </p>
      </div>
      {scoreLocked && !locked ? (
        <p className="px-4 text-sm text-muted">
          {livePosition == null
            ? "Scores unlock when the moderator shows a team."
            : `Team ${position} is ahead of the live video. You can score Team ${livePosition} or an earlier team.`}
        </p>
      ) : null}
      <p className="px-4 text-sm text-muted">
        {complete
          ? `Current total: ${rubricTotal({
              choreography: Number(draft.choreography),
              formations: Number(draft.formations),
              technique: Number(draft.technique),
              syncCleanliness: Number(draft.syncCleanliness),
              overallImpression: Number(draft.overallImpression),
            })} / 50.`
          : filled
            ? `Draft is ${filled} / 5 categories complete.`
            : "Pick a score to begin."}
      </p>
      <div className="flex flex-wrap items-center gap-2 px-4">
        <button
          type="button"
          className="btn btn-primary"
          disabled={scoreLocked && commentLocked}
          onClick={() => { void saveLatest(true); }}
        >
          Save
        </button>
      </div>
      <div className="px-4">
        <p
          role="status"
          className={`text-sm ${saveStatus === "error" ? "text-[var(--danger)]" : "text-muted"}`}
        >
          {saveStatus === "saving" ? "Saving…" :
            saveStatus === "unsaved" ? "Unsaved changes · autosave pending" :
            saveStatus === "saved" ? `Saved Team ${position}.` :
            saveStatus === "error" ? `${state?.error ?? "Could not save."} Use Save to retry.` :
            "Changes will save automatically."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-4">
        {prevPosition ? (
          <Link
            href={`/judge/${competitionId}/team/${prevPosition}?stay=1`}
            prefetch
            className="btn btn-ghost"
            onClick={(event) => navigateAfterSave(event, `/judge/${competitionId}/team/${prevPosition}?stay=1`)}
          >
            Team {prevPosition}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Link href={`/judge/${competitionId}`} prefetch className="btn btn-ghost" onClick={(event) => navigateAfterSave(event, `/judge/${competitionId}`)}>
            Packet List
          </Link>
          {!nextPosition && scoreSaved ? (
            <Link href={`/judge/${competitionId}`} prefetch className="btn btn-primary" onClick={(event) => navigateAfterSave(event, `/judge/${competitionId}`)}>
              Review Scores
            </Link>
          ) : null}
          {nextPosition && (locked || (livePosition != null && nextPosition <= livePosition)) ? (
            <Link
              href={`/judge/${competitionId}/team/${nextPosition}?stay=1`}
              prefetch
              className="btn btn-ghost"
              onClick={(event) => navigateAfterSave(event, `/judge/${competitionId}/team/${nextPosition}?stay=1`)}
            >
              Team {nextPosition}
            </Link>
          ) : null}
        </div>
      </div>
    </form>
  );
}
