"use client";

import { useActionState } from "react";
import { saveTeamProfile } from "@/app/actions/team";

type Profile = {
  name: string;
  photoUrl: string;
  blurb: string;
  wikiUrl: string;
  avDriveUrl: string;
  captains: string;
  yearsEstablished: number | null;
  rosterSize: number | null;
};

export function TeamProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(saveTeamProfile, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card p-6">
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
            defaultValue={profile.rosterSize ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="photoUrl">Team photo URL</label>
          <input
            id="photoUrl"
            name="photoUrl"
            type="url"
            required
            defaultValue={profile.photoUrl}
            placeholder="https://"
          />
        </div>
        <div className="field">
          <label htmlFor="wikiUrl">Team wiki URL</label>
          <input
            id="wikiUrl"
            name="wikiUrl"
            type="url"
            required
            defaultValue={profile.wikiUrl}
            placeholder="https://"
          />
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
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">Profile saved.</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save Team Profile"}
      </button>
    </form>
  );
}
