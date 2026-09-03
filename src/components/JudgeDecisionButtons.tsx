"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideJudgeRequest } from "@/app/actions/comp-judging";

export function JudgeDecisionButtons({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="btn btn-primary py-1.5"
        disabled={pending}
        onClick={() => {
          start(async () => {
            await decideJudgeRequest(assignmentId, "APPROVED");
            router.refresh();
          });
        }}
      >
        Approve
      </button>
      <button
        type="button"
        className="btn btn-ghost py-1.5"
        disabled={pending}
        onClick={() => {
          start(async () => {
            await decideJudgeRequest(assignmentId, "DENIED");
            router.refresh();
          });
        }}
      >
        Deny
      </button>
    </div>
  );
}
