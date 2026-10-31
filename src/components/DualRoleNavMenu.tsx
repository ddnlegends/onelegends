"use client";

import { usePathname } from "next/navigation";
import { NavLink } from "@/components/NavLink";

export function DualRoleNavMenu() {
  const pathname = usePathname();
  const active = pathname.startsWith("/team/") || pathname.startsWith("/comp/") || pathname === "/claim";

  return (
    <details key={pathname} className="group relative">
      <summary className={`cursor-pointer list-none whitespace-nowrap hover:text-accent [&::-webkit-details-marker]:hidden ${active ? "font-semibold text-accent" : "text-muted"}`}>
        Team &amp; Comp <span aria-hidden="true" className="ml-1 text-xs">▾</span>
      </summary>
      <div className="absolute right-0 top-full z-40 mt-3 flex min-w-52 flex-col gap-3 rounded-xl border border-line bg-card p-4 shadow-lg">
        <NavLink href="/team/profile" match="prefix">Team Profile</NavLink>
        <NavLink href="/team/decisions" match="prefix">Team Decisions</NavLink>
        <NavLink href="/comp/profile" match="prefix">Comp Details</NavLink>
        <NavLink href="/comp/competitions" match="prefix">All Competitions</NavLink>
        <NavLink href="/claim">Code Claim</NavLink>
      </div>
    </details>
  );
}
