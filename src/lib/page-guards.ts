/**
 * Page-level access checks.
 *
 * Layouts and pages render in parallel in this Next.js version, so a redirect
 * in a layout does not stop the page from querying and streaming its data.
 * Every page that reads private data must call a guard itself.
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformAdmin } from "@/lib/team-access";

/**
 * Layouts and pages render in parallel, so a layout redirect alone still lets the
 * page stream its data. Every tech-admin page must call this before querying.
 */
export async function requirePlatformAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await isPlatformAdmin(session.user.id))) redirect("/dashboard");
  return session.user;
}
