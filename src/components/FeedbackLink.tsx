"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FeedbackLink() {
  const pathname = usePathname();
  return <Link href={{ pathname: "/feedback", query: { from: pathname } }} className="py-2 font-semibold text-accent underline">Feedback</Link>;
}
