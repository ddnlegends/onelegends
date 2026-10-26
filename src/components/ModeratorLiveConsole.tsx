"use client";

/**
 * Moderator's live viewing console: Show / Next / Clear controls, the anonymous
 * viewing order, and a checkmark per judge per team. The moderator prepares
 * local video files before sharing; the live player never embeds Google Drive.
 */
import { useActionState, useEffect, useRef, useState } from "react";
import { setLiveTeam } from "@/app/actions/moderator";
import { SaveNotice } from "@/components/SaveNotice";

type TeamRow = {
  position: number;
  avDriveUrl: string;
  judges: { id: string; name: string; complete: boolean }[];
};

function ShowButton({
  action,
  pending,
  competitionId,
  position,
  label,
  primary = false,
  blocked = false,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  competitionId: string;
  position: number | "";
  label: string;
  primary?: boolean;
  blocked?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="position" value={position} />
      <button
        type="submit"
        disabled={pending || blocked}
        className={`btn ${primary ? "btn-primary" : "btn-ghost"} py-1.5`}
      >
        {label}
      </button>
    </form>
  );
}

export function ModeratorLiveConsole({
  competitionId,
  teams,
  livePosition,
}: {
  competitionId: string;
  teams: TeamRow[];
  livePosition: number | null;
}) {
  const [state, formAction, pending] = useActionState(setLiveTeam, undefined);
  const [videoUrls, setVideoUrls] = useState<Record<number, string>>({});
  const videoUrlsRef = useRef<Record<number, string>>({});
  const stageRef = useRef<HTMLElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [viewingMode, setViewingMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fileError, setFileError] = useState("");
  const [loadingPosition, setLoadingPosition] = useState<number | null>(null);
  useEffect(() => () => {
    Object.values(videoUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  const index = teams.findIndex((team) => team.position === livePosition);
  const live = index >= 0 ? teams[index] : null;
  const prev = index > 0 ? teams[index - 1] : null;
  const next =
    index >= 0 ? (teams[index + 1] ?? null) : (teams[0] ?? null);
  const shared = { action: formAction, pending, competitionId };
  const missingVideos = teams.filter((team) => team.avDriveUrl && !videoUrls[team.position]);
  const videosReady = missingVideos.length === 0;
  const selectVideo = async (position: number, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|ogv)$/i.test(file.name)) {
      setFileError(`Choose a video file for Team ${position}.`);
      return;
    }
    setLoadingPosition(position);
    // File.slice returns a nameless Blob, so even native video controls only see
    // an opaque blob URL rather than the team's original filename.
    const url = URL.createObjectURL(file.slice(0, file.size, file.type));
    const playable = await new Promise<boolean>((resolve) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = url;
    });
    setLoadingPosition(null);
    if (!playable) {
      URL.revokeObjectURL(url);
      setFileError(`This browser cannot play the selected video for Team ${position}. Choose a playable video file.`);
      return;
    }
    const previous = videoUrlsRef.current[position];
    videoUrlsRef.current = { ...videoUrlsRef.current, [position]: url };
    setVideoUrls(videoUrlsRef.current);
    if (previous) URL.revokeObjectURL(previous);
    setFileError("");
  };
  const canShow = (position: number) => {
    if (!viewingMode) return false;
    if (teams.some((team) => team.position === position && team.avDriveUrl && !videoUrls[position])) return false;
    if (livePosition != null && position <= livePosition) return true;
    return teams
      .filter((team) => team.position < position)
      .every((team) => team.judges.length > 0 && team.judges.every((judge) => judge.complete));
  };
  const nextBlocked = next != null && !canShow(next.position);
  const toggleFullscreen = () => {
    const request = fullscreen ? document.exitFullscreen() : stageRef.current?.requestFullscreen?.();
    void request?.catch(() => {});
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section ref={stageRef} className="anonymous-viewing-stage space-y-4">
        {!viewingMode ? (
          <div className="rounded-xl border border-line bg-blush p-4 text-sm">
            <p className="font-semibold">Prepare anonymous AV viewing</p>
            <p className="mt-1 text-muted">
              Before sharing your screen, download each team’s AV privately and select the matching video below. Videos stay in this browser tab and their filenames are never shown during viewing. If you reload the page, select the files again.
            </p>
            <button type="button" className="btn btn-ghost mt-3" onClick={() => setPreparing(!preparing)}>
              {preparing ? "Hide private preparation" : "Prepare videos privately"}
            </button>
            {preparing ? (
              <ol className="mt-3 space-y-3">
                {teams.map((team) => (
                  <li key={team.position} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-card p-3">
                    <span className="font-semibold">Team {team.position}</span>
                    {team.avDriveUrl ? (
                      <>
                        <a href={team.avDriveUrl} target="_blank" rel="noreferrer" className="underline">
                          Open original privately
                        </a>
                        <label className="btn btn-ghost cursor-pointer py-1.5">
                          {videoUrls[team.position] ? "Replace local video" : "Select local video"}
                          <input
                            type="file"
                            accept="video/*,.mov,.m4v"
                            className="sr-only"
                            aria-label={`Select local video for Team ${team.position}`}
                            disabled={loadingPosition != null}
                            onChange={(event) => {
                              void selectVideo(team.position, event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <span className="text-muted">{loadingPosition === team.position ? "Checking video…" : videoUrls[team.position] ? "Ready" : "Video needed"}</span>
                      </>
                    ) : <span className="text-muted">No AV link on file</span>}
                  </li>
                ))}
              </ol>
            ) : null}
            {fileError ? <p role="alert" className="mt-2 text-danger">{fileError}</p> : null}
            <button
              type="button"
              className="btn btn-primary mt-3"
              disabled={!videosReady || loadingPosition != null}
              onClick={() => { setPreparing(false); setViewingMode(true); }}
            >
              Begin anonymous viewing
            </button>
            {!videosReady ? <p className="mt-2 text-muted">Select local videos for {missingVideos.length} team{missingVideos.length === 1 ? "" : "s"} first.</p> : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-muted">Anonymous viewing mode: Google Drive filenames are hidden.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost py-1.5" onClick={toggleFullscreen}>
                {fullscreen ? "Exit fullscreen" : "Fullscreen viewing"}
              </button>
              {!fullscreen ? (
                <button type="button" className="btn btn-ghost py-1.5" onClick={() => {
                  if (window.confirm("Stop sharing your screen before opening private AV links. Leave viewing mode?")) setViewingMode(false);
                }}>
                  Leave viewing mode
                </button>
              ) : null}
            </div>
          </div>
        )}
        {live ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">
                Now showing
              </p>
              <h2 className="font-heading text-3xl">Team {live.position}</h2>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">
              Nothing on screen
            </p>
            <h2 className="font-heading text-3xl">Ready when you are</h2>
            <p className="mt-1 text-sm text-muted">
              Start with Team {teams[0]?.position ?? 1}. Judges’ sheets switch
              as soon as you press Show.
            </p>
          </div>
        )}

        {viewingMode && live && videoUrls[live.position] ? (
          <video
            key={live.position}
            src={videoUrls[live.position]}
            controls
            playsInline
            className="aspect-video w-full rounded-xl border border-line bg-black"
            aria-label={`Team ${live.position} audition video`}
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-line bg-blush text-sm text-muted">
            {live && !live.avDriveUrl ? "No audition video is on file for this team." : "The prepared video for the team you show appears here."}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
          {prev ? (
            <ShowButton
              {...shared}
              position={prev.position}
              label={`← Team ${prev.position}`}
              blocked={!canShow(prev.position)}
            />
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            {live ? (
              <ShowButton {...shared} position="" label="Clear screen" />
            ) : null}
            {next ? (
              <ShowButton
                {...shared}
                position={next.position}
                label={live ? `Next: Team ${next.position} →` : `Show Team ${next.position}`}
                primary
                blocked={nextBlocked}
              />
            ) : live ? (
              <span className="self-center text-sm text-muted">
                Last team. Judges can submit once every sheet is scored.
              </span>
            ) : null}
          </div>
        </div>
        {viewingMode && nextBlocked ? (
          <p className="text-sm text-muted">
            Wait for every approved judge to finish the earlier teams before moving ahead.
          </p>
        ) : null}
        <SaveNotice state={state} refresh={false} scroll={false} />
        {pending ? <p className="text-xs text-muted">Switching judges…</p> : null}
      </section>

      <aside className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
          Viewing order
        </h3>
        <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {teams.map((team) => {
            const isLive = team.position === livePosition;
            return (
              <li
                key={team.position}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                  isLive ? "bg-accent/5" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Team {team.position}</p>
                  {team.judges.length ? (
                    <ul
                      className="mt-2 space-y-1"
                      aria-label={`Team ${team.position} judge completion`}
                    >
                      {team.judges.map((judge) => (
                        <li
                          key={judge.id}
                          className="flex items-center justify-between gap-3 text-xs text-muted"
                        >
                          <span className="truncate">{judge.name}</span>
                          <span
                            aria-label={
                              judge.complete
                                ? `${judge.name} completed Team ${team.position}`
                                : `${judge.name} has not completed Team ${team.position}`
                            }
                            className={`grid size-5 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                              judge.complete
                                ? "border-success-line bg-success-soft text-success"
                                : "border-line bg-blush text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      No judges approved yet.
                    </p>
                  )}
                </div>
                {isLive ? (
                  <span className="rounded-full bg-brand-ember px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
                    Live
                  </span>
                ) : (
                  <ShowButton {...shared} position={team.position} label="Show" blocked={!canShow(team.position)} />
                )}
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
