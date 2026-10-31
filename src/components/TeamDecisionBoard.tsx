"use client";

import { useState, useTransition } from "react";
import { respondToCompetitionOffer } from "@/app/actions/offers";
import { PARTNER_CONFIRMATION_LIMIT } from "@/lib/application-offers";

export type TeamDecisionItem = {
  id: string;
  name: string;
  category: "Partner" | "Affiliate" | "Non-partner";
  status: string;
  canConfirm: boolean;
  canDecline: boolean;
  confirmed: boolean;
};

export function TeamDecisionBoard({ items, partnerConfirmed }: { items: TeamDecisionItem[]; partnerConfirmed: number }) {
  const [state, setState] = useState<{ error?: string; ok?: boolean; message?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<{ id: string; intent: "confirm" | "decline" } | null>(null);
  function submitChoice(formData: FormData) {
    startTransition(async () => {
      const result = await respondToCompetitionOffer(undefined, formData);
      setState(result);
      if (result.ok) setChoice(null);
    });
  }
  const selected = choice ? items.find((item) => item.id === choice.id) : null;
  const closing = selected?.category === "Partner" && choice?.intent === "confirm" && partnerConfirmed === PARTNER_CONFIRMATION_LIMIT - 1
    ? items.filter((item) => item.id !== selected.id && item.category === "Partner" && (item.canConfirm || item.status === "Waitlisted"))
    : [];
  const totalConfirmed = items.filter((item) => item.confirmed).length;
  const offers = items.filter((item) => item.canConfirm).length;
  const waitlisted = items.filter((item) => item.status === "Waitlisted").length;

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Partner spots confirmed", `${partnerConfirmed} / ${PARTNER_CONFIRMATION_LIMIT}`],
          ["Total spots confirmed", String(totalConfirmed)],
          ["Offers to answer", String(offers)],
          ["Waitlisted", String(waitlisted)],
        ].map(([label, value], index) => (
          <div key={label} className={`rounded-xl border p-4 ${index === 0 ? "border-accent bg-blush" : "border-line bg-card"}`}>
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-2 font-heading text-3xl">{value}</dd>
          </div>
        ))}
      </dl>

      {state?.error ? <p className="notice notice-error" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-success" role="status">{state.message}</p> : null}

      {(["Partner", "Affiliate", "Non-partner"] as const).map((category) => {
        const group = items.filter((item) => item.category === category);
        return (
          <section key={category} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-2xl">{category} competitions</h2>
              <p className="text-sm text-muted">{category === "Partner" ? `Maximum ${PARTNER_CONFIRMATION_LIMIT} confirmed` : "No confirmation limit"}</p>
            </div>
            {group.length ? <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
              {group.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-muted">{item.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.canConfirm ? <button className="btn btn-primary" type="button" onClick={() => setChoice({ id: item.id, intent: "confirm" })}>Confirm spot</button> : null}
                  {item.canDecline ? <button className="btn btn-ghost" type="button" onClick={() => setChoice({ id: item.id, intent: "decline" })}>{item.status === "Waitlisted" ? "Leave waitlist" : "Decline offer"}</button> : null}
                </div>
              </li>)}
            </ul> : <p className="text-sm text-muted">No applications in this category.</p>}
          </section>
        );
      })}

      {selected && choice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 p-4" role="presentation">
          <section className="w-full max-w-lg space-y-4 rounded-2xl border border-line bg-card p-6 shadow-xl" role="alertdialog" aria-modal="true" aria-labelledby="offer-confirm-title" aria-describedby="offer-confirm-description">
            <h2 id="offer-confirm-title" className="font-heading text-2xl">{choice.intent === "confirm" ? "Confirm this spot?" : selected.status === "Waitlisted" ? "Leave this waitlist?" : "Decline this offer?"}</h2>
            <p id="offer-confirm-description" className="text-sm text-muted">
              {choice.intent === "confirm"
                ? `Your team will commit to ${selected.name}.${selected.category === "Partner" ? ` This will bring your Partner total to ${partnerConfirmed + 1}/${PARTNER_CONFIRMATION_LIMIT}.` : ""}`
                : `Your team will turn down ${selected.name}. Only the host can offer a spot again.`}
            </p>
            {closing.length ? <div className="rounded-xl border border-warning-line bg-warning-soft p-4 text-sm text-warning">
              <p className="font-semibold">Reaching the Partner limit will close these other offers or waitlist positions:</p>
              <ul className="mt-2 list-disc pl-5">{closing.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
            </div> : null}
            {state?.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
            <form action={submitChoice} className="flex flex-wrap justify-end gap-2">
              <input type="hidden" name="applicationId" value={selected.id} />
              <input type="hidden" name="intent" value={choice.intent} />
              <input type="hidden" name="acknowledge" value="on" />
              <button className="btn btn-ghost" type="button" onClick={() => setChoice(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={pending} type="submit">{pending ? "Saving…" : choice.intent === "confirm" ? "Yes, confirm my spot" : "Yes, decline"}</button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
