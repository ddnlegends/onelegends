"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ApplicationStatus } from "@prisma/client";
import { setApplicationStatus } from "@/app/actions/comp";
import { statusLabel } from "@/lib/utils";

const STATUSES: ApplicationStatus[] = [
  "PENDING",
  "ACCEPTED",
  "WAITLISTED",
  "DECLINED",
];

export function StatusSelect({
  applicationId,
  value,
}: {
  applicationId: string;
  value: ApplicationStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <select
      className="rounded-md border border-line bg-card px-2 py-1 text-sm"
      defaultValue={value}
      disabled={pending}
      onChange={(event) => {
        const status = event.target.value as ApplicationStatus;
        start(async () => {
          await setApplicationStatus(applicationId, status);
          router.refresh();
        });
      }}
    >
      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {statusLabel(status)}
        </option>
      ))}
    </select>
  );
}
