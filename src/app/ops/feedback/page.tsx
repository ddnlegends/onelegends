import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { FeedbackStatusForm } from "@/components/FeedbackStatusForm";
import { requirePlatformAdminPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES, feedbackStatusSchema } from "@/lib/feedback";
import { LocalDateTime } from "@/components/LocalDateTime";

export const metadata = { title: "Feedback inbox · OneLegends", robots: { index: false, follow: false } };
const PAGE_SIZE = 25;

export default async function FeedbackInbox({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requirePlatformAdminPage();
  const query = await searchParams;
  const status = feedbackStatusSchema.safeParse(query.status);
  const where = status.success ? { status: status.data } : {};
  const total = await prisma.feedback.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number(query.page);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  const messages = await prisma.feedback.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
  });
  const pageLink = (number: number) => ({ pathname: "/ops/feedback", query: { ...(status.success ? { status: status.data } : {}), page: number } });

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading text-4xl">Feedback inbox</h1>
          <p className="mt-2 text-muted">Private messages from OneLegends users. Use their email to follow up, then update the status. Saving a status does not send an email.</p>
        </div>
        <form className="flex flex-wrap items-end gap-3" action="/ops/feedback">
          <div className="field">
            <label htmlFor="feedback-filter">Filter by status</label>
            <select id="feedback-filter" name="status" defaultValue={status.success ? status.data : ""}>
              <option value="">All messages</option>
              {Object.entries(FEEDBACK_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-ghost">Apply filter</button>
        </form>
        <p className="text-sm text-muted">{total} {total === 1 ? "message" : "messages"}{total ? ` · Page ${page} of ${pages}` : ""}</p>
        {!messages.length ? <p className="rounded-xl border border-line bg-card p-6">No feedback matches this filter.</p> : null}
        {messages.map((item) => (
          <article key={item.id} className="space-y-4 rounded-xl border border-line bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{FEEDBACK_CATEGORIES[item.category]} · {item.submitterName || item.submitterEmail}</h2>
                <a className="break-all text-sm text-accent underline" href={`mailto:${encodeURIComponent(item.submitterEmail)}`}>{item.submitterEmail}</a>
              </div>
              <p className="text-xs text-muted"><LocalDateTime date={item.createdAt} /> · {FEEDBACK_STATUSES[item.status]}</p>
            </div>
            <p className="whitespace-pre-wrap break-words">{item.message}</p>
            <details className="rounded-lg bg-blush p-3 text-sm">
              <summary className="cursor-pointer font-medium">Account and page details</summary>
              <dl className="mt-3 space-y-2 break-words text-muted">
                <div><dt className="font-medium text-ink">Account role at submission</dt><dd>{item.accountRole}</dd></div>
                {item.accountContext ? <div><dt className="font-medium text-ink">Access at submission</dt><dd className="whitespace-pre-wrap">{item.accountContext}</dd></div> : null}
                <div><dt className="font-medium text-ink">Page</dt><dd>{item.pagePath || "Not provided"}</dd></div>
                <div><dt className="font-medium text-ink">Reference</dt><dd className="break-all">{item.id}</dd></div>
                <div><dt className="font-medium text-ink">User ID</dt><dd className="break-all">{item.userId || "Account deleted"}</dd></div>
              </dl>
            </details>
            <FeedbackStatusForm id={item.id} status={item.status} />
            {item.statusUpdatedByEmail ? <p className="break-words text-xs text-muted">Last updated by {item.statusUpdatedByEmail} · <LocalDateTime date={item.updatedAt} /></p> : null}
          </article>
        ))}
        {pages > 1 ? <nav aria-label="Feedback pages" className="flex gap-4">
          {page > 1 ? <Link className="btn btn-ghost" href={pageLink(page - 1)}>Newer messages</Link> : null}
          {page < pages ? <Link className="btn btn-ghost" href={pageLink(page + 1)}>Older messages</Link> : null}
        </nav> : null}
      </div>
    </PageShell>
  );
}
