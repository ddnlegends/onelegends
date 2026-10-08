"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { saveCompProfile } from "@/app/actions/comp";

type Profile = {
  name: string;
  dates: string;
  location: string;
  venue: string;
  stageSize: string;
  productionNotes: string;
  lighting: string;
  description: string;
  googleSheetUrl: string;
  acceptingApps: boolean;
  earlyApplicationDeadline: string;
  applicationDeadline: string;
  requiredJudgeCount: number;
};

const noopSubscribe = () => () => {};

function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * datetime-local has no timezone, so the browser converts it to an ISO instant
 * before submit; the server would otherwise read it in its own (UTC) zone.
 */
function DeadlineField({
  iso,
  name,
  label,
  help,
}: {
  iso: string;
  name: string;
  label: string;
  help: string;
}) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [edited, setEdited] = useState<string | null>(null);
  const local = edited ?? (hydrated ? isoToLocalInput(iso) : null);
  const submitted =
    local === null ? iso : local ? new Date(local).toISOString() : "";
  const zone = hydrated
    ? Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")
    : "";

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        key={hydrated ? "client" : "server"}
        id={name}
        type="datetime-local"
        defaultValue={local ?? ""}
        onChange={(event) => setEdited(event.target.value)}
      />
      <input type="hidden" name={name} value={submitted} />
      <p className="text-xs text-muted">
        {zone ? `In your time zone (${zone}). ` : ""}{help}
      </p>
    </div>
  );
}

export function CompProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(saveCompProfile, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card p-6">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="acceptingApps"
          defaultChecked={profile.acceptingApps}
        />
        Accepting Applications
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor="name">Competition name</label>
          <input id="name" value={profile.name} disabled />
          <p className="text-xs text-muted">
            Official listing name. It is tied to your claim code and cannot be
            changed here.
          </p>
        </div>
        <div className="field">
          <label htmlFor="dates">Event dates</label>
          <input id="dates" name="dates" defaultValue={profile.dates} />
          <p className="text-xs text-muted">
            Shown as Event on Home and the public listing.
          </p>
        </div>
        <div className="field">
          <label htmlFor="location">Location (city)</label>
          <input id="location" name="location" defaultValue={profile.location} />
        </div>
        <DeadlineField
          iso={profile.earlyApplicationDeadline}
          name="earlyApplicationDeadline"
          label="Early application deadline"
          help="Shown to teams as the early deadline. Applications stay open after this time."
        />
        <DeadlineField
          iso={profile.applicationDeadline}
          name="applicationDeadline"
          label="Late application deadline"
          help="Shown as the final deadline. After this time, applications close even if Accepting Applications is checked. Clear it for no automatic close."
        />
        <div className="field">
          <label htmlFor="requiredJudgeCount">Required judges (N)</label>
          <input
            id="requiredJudgeCount"
            name="requiredJudgeCount"
            type="number"
            min={1}
            max={50}
            required
            defaultValue={profile.requiredJudgeCount}
          />
        </div>
        <div className="field">
          <label htmlFor="venue">Venue</label>
          <input id="venue" name="venue" defaultValue={profile.venue} />
        </div>
        <div className="field">
          <label htmlFor="stageSize">Stage size / dimensions</label>
          <input
            id="stageSize"
            name="stageSize"
            defaultValue={profile.stageSize}
            placeholder="40' x 32'"
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="lighting">Lighting</label>
          <textarea id="lighting" name="lighting" defaultValue={profile.lighting} />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="productionNotes">Production notes</label>
          <textarea
            id="productionNotes"
            name="productionNotes"
            defaultValue={profile.productionNotes}
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="description">Comp details</label>
          <textarea
            id="description"
            name="description"
            defaultValue={profile.description}
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="googleSheetUrl">Applicant Google Sheet URL or ID</label>
          <input
            id="googleSheetUrl"
            name="googleSheetUrl"
            defaultValue={profile.googleSheetUrl}
            placeholder="https://docs.google.com/spreadsheets/d/..."
          />
          <p className="text-xs text-muted">
            Optional. Share the sheet with the service account as Editor so
            applicant rows (including AV Drive links) can sync automatically.
          </p>
        </div>
      </div>
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">Competition details saved.</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save Details"}
      </button>
    </form>
  );
}
