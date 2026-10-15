import { randomUUID } from "node:crypto";
import Link from "next/link";
import { auth } from "@/auth";
import { FeedbackForm } from "@/components/FeedbackForm";
import { PageShell } from "@/components/PageShell";
import { getCachedUser } from "@/lib/cached-user";
import { feedbackPagePath } from "@/lib/feedback";

export const metadata = { title: "Feedback · OneLegends", robots: { index: false, follow: false } };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const session = await auth();
  const user = session?.user ? await getCachedUser(session.user.id) : null;
  const pagePath = feedbackPagePath((await searchParams).from);
  return (
    <PageShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-heading text-4xl">Feedback</h1>
          <p className="mt-3 text-muted">Questions, comments, concerns, or ideas for OneLegends? Send a message to the Legends tech team.</p>
        </div>
        {user ? <FeedbackForm submissionKey={randomUUID()} name={user.name} email={user.email} pagePath={pagePath} /> : (
          <div className="space-y-4 rounded-xl border border-line bg-card p-6">
            <p>Sign in to send feedback so we can attach your account and follow up with you.</p>
            <Link className="btn btn-primary" href="/login?next=/feedback">Sign in to send feedback</Link>
          </div>
        )}
        {user?.platformAdmin ? <Link className="inline-block text-accent underline" href="/ops/feedback">Open feedback inbox</Link> : null}
      </div>
    </PageShell>
  );
}
