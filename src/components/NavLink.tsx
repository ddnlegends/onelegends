"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  match,
}: {
  href: string;
  children: ReactNode;
  match?: "exact" | "prefix";
}) {
  const pathname = usePathname();
  const active =
    match === "prefix"
      ? pathname === href || pathname.startsWith(`${href}/`)
      : pathname === href;

  return (
    <Link
      href={href}
      className={
        active
          ? "font-semibold text-accent"
          : "text-muted hover:text-accent"
      }
    >
      {children}
    </Link>
  );
}
