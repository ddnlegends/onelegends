"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function SaveNotice({
  state,
  fallbackOk = "Changes saved.",
  refresh = true,
  scroll = true,
}: {
  state: { ok?: boolean; error?: string; message?: string } | undefined;
  fallbackOk?: string;
  refresh?: boolean;
  scroll?: boolean;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const wasOk = useRef(false);

  useEffect(() => {
    if (state?.error) {
      wasOk.current = false;
      if (scroll) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (state?.ok && !wasOk.current) {
      wasOk.current = true;
      if (scroll) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (refresh) router.refresh();
    }
    if (!state?.ok) wasOk.current = false;
  }, [state?.ok, state?.error, refresh, router, scroll]);

  if (state?.error) {
    return (
      <p ref={ref} className="notice notice-error" role="status">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p ref={ref} className="notice notice-ok" role="status">
        {state.message ?? fallbackOk}
      </p>
    );
  }
  return null;
}
