"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveTeamScores } from "@/app/actions/judge";
import { RUBRIC_CATEGORIES, rubricTotal } from "@/lib/judging";
import { DriveAvPlayer } from "@/components/DriveAvPlayer";
import { SaveNotice } from "@/components/SaveNotice";
import { SubmitPacketButton } from "@/components/SubmitPacketButton";

const SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => i);

type Saved = {
  choreography: number;
  formations: number;
  technique: number;
  syncCleanliness: number;
  overallImpression: number;
  comment?: string;
};

export function JudgeScoreForm({
  competitionId,
  assignmentId,
  position,
  totalTeams,
  avDriveUrl,
  saved,
  locked,
  live = false,
}: {
  competitionId: string;
  assignmentId: string;
  position: number;
  totalTeams: number;
  avDriveUrl: string;
  saved: Saved | null;
  locked: boolean;
  live?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveTeamScores, undefined);
  const prev = !live && position > 1 ? position - 1 : null;
  const next = !live && position < totalTeams ? position + 1 : null;

  return (
    <div className="space-y-6">
      {live ? (
        <p className="rounded-xl border border-line bg-blush p-4 text-sm">
          Watch the chair’s Zoom screenshare for Team {position}. This page is
          the scoresheet only.
        </p>
      ) : (
        <DriveAvPlayer
          url={avDriveUrl}
          label={`Team ${position} audition video`}
          scoringHint
        />
      )}

      <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="position" value={position} />
        <div className="rounded-t-xl bg-accent px-4 py-3 text-white">
          <p className="font-heading text-lg tracking-wide">Team {position}</p>
          <p className="text-xs uppercase tracking-widest text-white/80">
            Rubric · 0–10 whole numbers · Max 50
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
                required
                disabled={locked}
                defaultValue={saved?.[category.key] ?? ""}
              >
                <option value="" disabled>
                  —
                </option>
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
          />
          <p className="text-xs text-muted">
            The competition sees this after results unlock. Other judges never
            see it, and the team name stays hidden from you.
          </p>
        </div>
        <p className="px-4 text-sm text-muted">
          {live
            ? saved
              ? `Saved total: ${rubricTotal(saved)} / 50. Wait for the chair to go to the next team.`
              : "Save this team, then wait. The chair advances when every judge has saved."
            : saved
              ? `Saved total: ${rubricTotal(saved)} / 50. You can change scores until you submit the full packet.`
              : "Save this team, then continue. You can come back from the packet list."}
        </p>
        <div className="px-4">
          <SaveNotice state={state} fallbackOk={`Scores saved for Team ${position}.`} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-4">
          {prev ? (
            <Link
              href={`/judge/${competitionId}/team/${prev}`}
              className="btn btn-ghost"
            >
              Team {prev}
            </Link>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {live ? null : (
              <Link href={`/judge/${competitionId}`} className="btn btn-ghost">
                Packet List
              </Link>
            )}
            {locked ? null : (
              <button className="btn btn-primary" disabled={pending} type="submit">
                {pending ? "Saving…" : "Save Scores"}
              </button>
            )}
            {next ? (
              <Link
                href={`/judge/${competitionId}/team/${next}`}
                className="btn btn-ghost"
              >
                Team {next}
              </Link>
            ) : null}
          </div>
        </div>
      </form>
      {live && !locked && position === totalTeams && saved ? (
        <SubmitPacketButton assignmentId={assignmentId} ready />
      ) : null}
    </div>
  );
}
