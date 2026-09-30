"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setJudgingOpen } from "@/app/actions/ops-judging";
import { SaveNotice } from "@/components/SaveNotice";

export function JudgingControls({
  competitionId,
  judgingOpen,
  appsOpen,
  claimed,
  showLiveLink = false,
}: {
  competitionId: string;
  judgingOpen: boolean;
  appsOpen: boolean;
  claimed: boolean;
  showLiveLink?: boolean;
}) {
  const [state, formAction, pending] = useActionState(setJudgingOpen, undefined);

  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          Circuit ops · judging
        </p>
        <p className="mt-1 font-medium">
          {!claimed
            ? "This listing is unclaimed."
            : appsOpen
              ? "Applications are still open."
              : judgingOpen
                ? "Judging is open."
                : "Judging is closed."}
        </p>
        <p className="mt-1 text-sm text-muted">
          {!claimed
            ? "A competition admin has to claim it before you can open judging or watch live scores."
            : "Only Legends Admin can open or close judging. Judges are locked while it is closed."}
        </p>
      </div>
      <SaveNotice state={state} />
      {claimed ? (
        <div className="flex flex-wrap gap-2">
          <form action={formAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="competitionId" value={competitionId} />
            {judgingOpen ? (
              <>
                <input type="hidden" name="open" value="0" />
                <button className="btn btn-ghost" disabled={pending} type="submit">
                  {pending ? "Closing…" : "Close judging"}
                </button>
              </>
            ) : (
              <>
                <input type="hidden" name="open" value="1" />
                <button
                  className="btn btn-primary"
                  disabled={pending || appsOpen}
                  type="submit"
                >
                  {pending ? "Opening…" : "Open judging"}
                </button>
              </>
            )}
          </form>
          {judgingOpen && showLiveLink ? (
            <Link href="/comp/live" prefetch className="btn btn-primary">
              Live View
            </Link>
          ) : null}
        </div>
      ) : null}
      {claimed && appsOpen ? (
        <p className="text-sm text-muted">
          Close applications first. Judging cannot open while teams can still
          apply.
        </p>
      ) : null}
    </div>
  );
}
