"use client";

import { useActionState, useState } from "react";
import { saveCompetitionPacket } from "@/app/actions/competition-packet";
import { packetFileError } from "@/lib/competition-packet";
import { SaveNotice } from "@/components/SaveNotice";

export function CompetitionPacketForm({ competitionId, filename }: { competitionId: string; filename: string | null }) {
  const [state, action, pending] = useActionState(saveCompetitionPacket, undefined);
  const [fileError, setFileError] = useState<string | null>(null);
  return (
    <form action={action} className="space-y-4 rounded-xl border border-line bg-card p-6" onSubmit={(event) => {
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      if (submitter instanceof HTMLButtonElement && submitter.value === "remove") return;
      const file = new FormData(event.currentTarget).get("packet");
      const error = file instanceof File ? packetFileError(file) : "Choose a PDF application packet.";
      setFileError(error);
      if (error) event.preventDefault();
    }}>
      <h2 className="font-heading text-2xl">Application packet</h2>
      <p className="text-sm text-muted">Upload a PDF up to 3 MB. Teams can download it from your public listing once your required competition details are complete. Uploading a new packet replaces the previous file.</p>
      {filename ? <p className="text-sm">Current packet: <a className="text-accent underline" href={`/api/competitions/${competitionId}/packet`}>{filename}</a></p> : <p className="text-sm text-muted">No application packet uploaded.</p>}
      <div className="field">
        <label htmlFor="packet">Application packet PDF</label>
        <input id="packet" name="packet" type="file" accept=".pdf,application/pdf" disabled={pending} onChange={(event) => setFileError(event.target.files?.[0] ? packetFileError(event.target.files[0]) : null)} />
      </div>
      {fileError ? <p role="alert" className="notice notice-error">{fileError}</p> : null}
      <SaveNotice state={state} scroll={false} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="upload" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : filename ? "Replace packet" : "Upload packet"}</button>
        {filename ? <button type="submit" name="intent" value="remove" className="btn btn-ghost" disabled={pending} onClick={() => setFileError(null)}>Remove packet</button> : null}
      </div>
    </form>
  );
}
