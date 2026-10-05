"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveTeamProfile } from "@/app/actions/team";
import { TeamPhoto } from "@/components/TeamPhoto";
import { SaveNotice } from "@/components/SaveNotice";
import {
  TEAM_PHOTO_TOO_LARGE,
  hasTeamPhoto,
  isBodyLimitError,
  teamPhotoFileError,
} from "@/lib/team-photo-rules";

type Profile = {
  name: string;
  photoUrl: string;
  blurb: string;
  avDriveUrl: string;
  captains: string;
  yearsEstablished: number | null;
  rosterSize: number | null;
};

type SaveState = {
  error?: string;
  ok?: boolean;
  message?: string;
  photoUrl?: string;
};

async function submitTeamProfile(
  prev: SaveState | undefined,
  formData: FormData,
): Promise<SaveState> {
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const problem = teamPhotoFileError(photo);
    if (problem) return { error: problem };
  }

  try {
    return await saveTeamProfile(prev, formData);
  } catch (error) {
    if (isBodyLimitError(error)) {
      return { error: TEAM_PHOTO_TOO_LARGE };
    }
    return {
      error: "Could not save the photo. Try again.",
    };
  }
}

export function TeamProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(
    submitTeamProfile,
    undefined,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [rosterSize, setRosterSize] = useState(String(profile.rosterSize ?? ""));
  const [rosterFromServer, setRosterFromServer] = useState(profile.rosterSize);
  if (profile.rosterSize !== rosterFromServer) {
    setRosterFromServer(profile.rosterSize);
    setRosterSize(String(profile.rosterSize ?? ""));
  }
  const [seenSave, setSeenSave] = useState<SaveState | undefined>(state);
  if (state !== seenSave) {
    setSeenSave(state);
    if (state?.ok) {
      setPickedName(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }
  const photoInput = useRef<HTMLInputElement>(null);
  const savedPhoto = hasTeamPhoto(state?.photoUrl ?? profile.photoUrl)
    ? (state?.photoUrl ?? profile.photoUrl)
    : "";
  const photoSrc = preview ?? savedPhoto;
  const notice = photoError ? { error: photoError } : state;

  useEffect(() => {
    if (!state?.ok || !photoInput.current) return;
    photoInput.current.value = "";
  }, [state]);

  function clearPickedFile() {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPickedName(null);
    if (photoInput.current) photoInput.current.value = "";
  }

  function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPickedName(null);
    if (!file) {
      setPhotoError(null);
      return;
    }
    const problem = teamPhotoFileError(file);
    if (problem) {
      setPhotoError(problem);
      event.target.value = "";
      return;
    }
    setPhotoError(null);
    setPickedName(file.name);
    setPreview(URL.createObjectURL(file));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const file = photoInput.current?.files?.[0];
    if (!file) return;
    const problem = teamPhotoFileError(file);
    if (problem) {
      event.preventDefault();
      setPhotoError(problem);
      clearPickedFile();
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-line bg-card p-6"
    >
      <p className="text-sm text-muted">
        Every field is required. You cannot apply to competitions until this
        profile and the dancer roster below are complete.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor="name">Team name</label>
          <input id="name" name="name" required defaultValue={profile.name} />
        </div>
        <div className="field">
          <label htmlFor="captains">Captains</label>
          <input
            id="captains"
            name="captains"
            required
            defaultValue={profile.captains}
            placeholder="Name, Name"
          />
        </div>
        <div className="field">
          <label htmlFor="yearsEstablished">Years established</label>
          <input
            id="yearsEstablished"
            name="yearsEstablished"
            type="number"
            min={0}
            required
            defaultValue={profile.yearsEstablished ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="rosterSize">Rostered dancers</label>
          <input
            id="rosterSize"
            name="rosterSize"
            type="number"
            min={1}
            required
            value={rosterSize}
            onChange={(e) => setRosterSize(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Team photo
          </span>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TeamPhoto
              src={photoSrc}
              name={profile.name || "Team photo"}
              size="md"
            />
            <div className="min-w-0 flex-1 space-y-2">
              {pickedName ? (
                <p className="text-sm">
                  Selected <span className="font-medium">{pickedName}</span>.
                  Save the profile to keep it.
                </p>
              ) : photoSrc ? (
                <p className="text-sm font-semibold text-emerald-700">
                  Photo saved.
                </p>
              ) : (
                <p className="text-sm text-muted">No photo yet.</p>
              )}
              <label className="btn btn-ghost w-fit cursor-pointer py-1.5">
                {photoSrc || pickedName ? "Replace photo" : "Upload photo"}
                <input
                  ref={photoInput}
                  id="photo"
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  required={!photoSrc}
                  className="sr-only"
                  onChange={onPhotoChange}
                />
              </label>
              <p className="text-xs text-muted">
                JPEG, PNG, WebP, or GIF up to 5MB. It also shows on your
                dashboard next to the team name.
              </p>
            </div>
          </div>
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="avDriveUrl">AV Google Drive link</label>
          <input
            id="avDriveUrl"
            name="avDriveUrl"
            type="url"
            required
            defaultValue={profile.avDriveUrl}
            placeholder="https://drive.google.com/file/d/..."
          />
          <p className="text-xs text-muted">
            Use a Google Drive <strong>file</strong> link (anyone with the link
            can view) so judges can watch in-app. Folder links cannot play inline
            without showing file names.
          </p>
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="blurb">Team blurb</label>
          <textarea id="blurb" name="blurb" required defaultValue={profile.blurb} />
        </div>
      </div>
      <SaveNotice state={notice} />
      <button
        className="btn btn-primary"
        disabled={pending || Boolean(photoError)}
        type="submit"
      >
        {pending ? "Saving…" : "Save Team Profile"}
      </button>
    </form>
  );
}
