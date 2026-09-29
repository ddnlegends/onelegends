"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationPulse() {
  const pathname = usePathname();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      if (/^https?:\/\//i.test(href)) return;
      const nextPath = href.split("?")[0];
      if (nextPath === pathname) return;
      setTarget(nextPath);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  if (!target || target === pathname) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
      role="progressbar"
      aria-label="Loading page"
    >
      <div className="h-full w-full origin-left animate-nav-pulse brand-gradient" />
    </div>
  );
}
