"use client";

import { useActionState } from "react";
import { saveCompetitionPacketLink } from "@/app/actions/competition-packet";
import { SaveNotice } from "@/components/SaveNotice";

export function CompetitionPacketForm({ competitionId, url, legacyFilename }: { competitionId: string; url: string | null; legacyFilename: string | null }) {
  const [state, action, pending] = useActionState(saveCompetitionPacketLink, undefined);
  return (
    <form action={action} className="space-y-4 rounded-xl border border-line bg-card p-6">
      <h2 className="font-heading text-2xl">Application packet</h2>
      <p className="text-sm text-muted">Paste a Google Drive file link. In Google Drive, set Share → General access to <strong>Anyone with the link</strong> and the role to <strong>Viewer</strong>. Test the link in a private window so teams can open it without requesting access.</p>
      {url ? <p className="text-sm">Current packet: <a className="break-all text-accent underline" href={url} target="_blank" rel="noopener noreferrer">Open Google Drive link</a></p> : legacyFilename ? <p className="text-sm">Current packet: <a className="text-accent underline" href={`/api/competitions/${competitionId}/packet`}>{legacyFilename}</a></p> : <p className="text-sm text-muted">No application packet linked.</p>}
      <div className="field">
        <label htmlFor="packetDriveUrl">Google Drive file link</label>
        <input id="packetDriveUrl" name="packetDriveUrl" type="url" defaultValue={url ?? ""} placeholder="https://drive.google.com/file/d/…/view" disabled={pending} />
      </div>
      <SaveNotice state={state} scroll={false} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="save" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save packet link"}</button>
        {url || legacyFilename ? <button type="submit" name="intent" value="remove" formNoValidate className="btn btn-ghost" disabled={pending}>Remove packet</button> : null}
      </div>
    </form>
  );
}
