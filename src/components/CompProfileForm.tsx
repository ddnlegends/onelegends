"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { saveCompProfile } from "@/app/actions/comp";
import { SaveNotice } from "@/components/SaveNotice";
import { competitionProfileGaps } from "@/lib/competition-profile";

type Profile = {
  name: string;
  dates: string;
  eventStartDate: string;
  eventEndDate: string;
  location: string;
  venue: string;
  venueAddress: string;
  earlyApplicationFee: string;
  regularApplicationFee: string;
  lateApplicationFee: string;
  paymentInstructions: string;
  stageSize: string;
  productionNotes: string;
  lighting: string;
  description: string;
  acceptingApps: boolean;
  earlyTierDeadline: string;
  earlyApplicationDeadline: string;
  applicationDeadline: string;
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
  const complete = competitionProfileGaps(profile).length === 0;
  const [datesTbd, setDatesTbd] = useState(!profile.eventStartDate && (!profile.dates || /^(TBD|TBA|N\/A)$/i.test(profile.dates)));
  const [startDate, setStartDate] = useState(profile.eventStartDate);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card p-6">
      <p className="text-sm text-muted">
        Details marked * are required before teams can see this competition. Write N/A or TBD in text fields if needed, or mark event dates as to be announced. Fees, venue address, and payment instructions are optional. You can save an incomplete draft.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="acceptingApps"
          defaultChecked={profile.acceptingApps && complete}
        />
        Accepting Applications
      </label>
      <p className="text-xs text-muted">Applications can open only after every required detail is filled. Leave this off until you are ready for teams to apply.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor="name">Competition name</label>
          <input id="name" value={profile.name} disabled />
          <p className="text-xs text-muted">
            Official listing name. It is tied to your claim code and cannot be
            changed here.
          </p>
        </div>
        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="text-sm font-medium">Event dates *</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="eventDatesTbd" checked={datesTbd} onChange={(event) => setDatesTbd(event.target.checked)} />
            Dates to be announced
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="eventStartDate">Event start date</label>
              <input id="eventStartDate" name="eventStartDate" type="date" disabled={datesTbd} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="eventEndDate">Event end date</label>
              <input id="eventEndDate" name="eventEndDate" type="date" disabled={datesTbd} min={startDate || undefined} defaultValue={profile.eventEndDate} />
            </div>
          </div>
          <p className="text-xs text-muted">Choose a range, or leave the end date blank for a single-day event. These are the event’s local calendar dates.</p>
          {!profile.eventStartDate && profile.dates && !datesTbd ? <p className="text-xs text-muted">Current dates: {profile.dates}. These stay unchanged until you choose dates or mark them to be announced.</p> : null}
        </fieldset>
        <div className="field sm:col-span-2">
          <label htmlFor="location">Location (city) *</label>
          <input id="location" name="location" defaultValue={profile.location} />
        </div>
        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="text-sm font-medium">Application periods</legend>
          <p className="text-xs text-muted">Use any combination of Early, Regular, and Late. Dates must be in order. When you change the schedule, the last date entered becomes the final application cutoff. Existing schedules keep their current cutoff until you edit a date.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <DeadlineField iso={profile.earlyTierDeadline} name="earlyTierDeadline" label="Early application deadline" help="Optional. Ends the Early application period." />
            <DeadlineField iso={profile.earlyApplicationDeadline} name="earlyApplicationDeadline" label="Regular application deadline" help="Optional. Ends the Regular application period when a later period exists." />
            <DeadlineField iso={profile.applicationDeadline} name="applicationDeadline" label="Late application deadline" help="Optional. Ends the Late application period." />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="field">
              <label htmlFor="earlyApplicationFee">Early application fee (USD per team)</label>
              <input id="earlyApplicationFee" name="earlyApplicationFee" type="number" min="0" max="99999.99" step="0.01" defaultValue={profile.earlyApplicationFee} placeholder="Not provided" />
            </div>
            <div className="field">
              <label htmlFor="regularApplicationFee">Regular application fee (USD per team)</label>
              <input id="regularApplicationFee" name="regularApplicationFee" type="number" min="0" max="99999.99" step="0.01" defaultValue={profile.regularApplicationFee} placeholder="Not provided" />
            </div>
            <div className="field">
              <label htmlFor="lateApplicationFee">Late application fee (USD per team)</label>
              <input id="lateApplicationFee" name="lateApplicationFee" type="number" min="0" max="99999.99" step="0.01" defaultValue={profile.lateApplicationFee} placeholder="Not provided" />
            </div>
          </div>
          <p className="text-xs text-muted">Fees are total USD per team and tracked outside OneLegends. Enter 0 for free; leave blank if not announced. A fee without a matching deadline is informational only.</p>
        </fieldset>
        <div className="field sm:col-span-2">
          <label htmlFor="paymentInstructions">Payment instructions</label>
          <textarea id="paymentInstructions" name="paymentInstructions" rows={4} maxLength={5000} defaultValue={profile.paymentInstructions} placeholder="Payment link or handle, recipient, payment deadlines, and what teams should include in the payment note" />
          <p className="text-xs text-muted">Shown publicly on your listing. Include payment links or handles, not passwords or private account details. Payments are handled outside OneLegends.</p>
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="venue">Venue *</label>
          <input id="venue" name="venue" defaultValue={profile.venue} />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="venueAddress">Venue address</label>
          <textarea id="venueAddress" name="venueAddress" rows={2} maxLength={1000} defaultValue={profile.venueAddress} placeholder="Street address, city, state, and ZIP code" />
        </div>
        <div className="field">
          <label htmlFor="stageSize">Stage size / dimensions *</label>
          <input
            id="stageSize"
            name="stageSize"
            defaultValue={profile.stageSize}
            placeholder="40' x 32'"
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="lighting">AV guidelines *</label>
          <textarea id="lighting" name="lighting" rows={4} defaultValue={profile.lighting} placeholder="Audio/video requirements, file formats, submission instructions, and lighting guidelines" />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="productionNotes">Production notes *</label>
          <textarea
            id="productionNotes"
            name="productionNotes"
            defaultValue={profile.productionNotes}
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="description">Competition bio *</label>
          <textarea
            id="description"
            name="description"
            defaultValue={profile.description}
            rows={5}
            placeholder="Introduce your competition, its history, and what teams can look forward to."
          />
        </div>
      </div>
      <SaveNotice state={state} scroll={false} />
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Saving…" : "Save Details"}
      </button>
    </form>
  );
}
