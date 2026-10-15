"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitFeedback } from "@/app/actions/feedback";
import { FEEDBACK_CATEGORIES, FEEDBACK_MESSAGE_LIMIT } from "@/lib/feedback";

export function FeedbackForm({ submissionKey, name, email, pagePath }: { submissionKey: string; name: string; email: string; pagePath: string }) {
  const [key, setKey] = useState(submissionKey);
  return <FeedbackEntry key={key} submissionKey={key} name={name} email={email} pagePath={pagePath} onAnother={() => setKey(crypto.randomUUID())} />;
}

function FeedbackEntry({ submissionKey, name, email, pagePath, onAnother }: { submissionKey: string; name: string; email: string; pagePath: string; onAnother: () => void }) {
  const [state, action, pending] = useActionState(submitFeedback, undefined);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("FEEDBACK");

  if (state?.ok) return (
    <section className="space-y-4 rounded-xl border border-success-line bg-success-soft p-6" aria-label="Feedback confirmation">
      <div role="status">
        <h2 className="font-heading text-2xl">Thanks for reaching out.</h2>
        <p className="mt-2">Your message is saved for the Legends tech team. If a reply is needed, they can contact you at {email}.</p>
        <p className="mt-3 break-all text-xs text-muted">Reference: {state.feedbackId}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link className="btn btn-primary" href={pagePath || "/dashboard"}>Back to the site</Link>
        <button className="btn btn-ghost" type="button" onClick={onAnother}>Send another message</button>
      </div>
    </section>
  );

  return (
    <form action={action} className="space-y-5 rounded-xl border border-line bg-card p-6" aria-label="Send feedback">
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <input type="hidden" name="pagePath" value={pagePath} />
      <div className="rounded-lg bg-blush p-4 text-sm">
        <p className="font-semibold">Sending as {name || email}</p>
        {name ? <p className="break-all text-muted">{email}</p> : null}
        <p className="mt-2 text-muted" id="feedback-privacy">Your name, email, account role, team or competition access, and this page are shared only with circuit tech admins so they can follow up.</p>
        {pagePath ? <p className="mt-2 break-all text-xs text-muted">Page: {pagePath}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="feedback-category">What would you like to share?</label>
        <select id="feedback-category" name="category" value={category} onChange={(event) => setCategory(event.target.value)} disabled={pending}>
          {Object.entries(FEEDBACK_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="feedback-message">Your message</label>
        <textarea id="feedback-message" name="message" rows={7} required maxLength={FEEDBACK_MESSAGE_LIMIT} value={message} onChange={(event) => setMessage(event.target.value)} readOnly={pending} aria-describedby="feedback-privacy feedback-length" placeholder="Tell us what happened, what you expected, or what could be better." />
        <p id="feedback-length" className="text-xs text-muted">{message.length.toLocaleString()} / 5,000 characters</p>
      </div>
      {state?.error ? <p className="notice notice-error" role="alert">{state.error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending || !message.trim()}>{pending ? "Sending…" : "Send feedback"}</button>
    </form>
  );
}
