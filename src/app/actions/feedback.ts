"use server";

/** Private user submissions and circuit tech-admin triage. Identity comes from
 * the current database account, never from submitted names, emails, or roles. */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { feedbackSchema, feedbackStatusSchema, FEEDBACK_WINDOW_LIMIT, FEEDBACK_WINDOW_MINUTES, type FeedbackState } from "@/lib/feedback";

export async function submitFeedback(_prev: FeedbackState | undefined, form: FormData): Promise<FeedbackState> {
  const sessionUser = await requireUser();
  if (!sessionUser) return { error: "Sign in to send feedback. Your message has not been sent." };
  const parsed = feedbackSchema.safeParse({
    submissionKey: form.get("submissionKey"), category: form.get("category"),
    message: form.get("message"), pagePath: form.get("pagePath"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your message and try again." };

  let result: FeedbackState;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Serialize each account's limit check and insert across server instances.
      // Repeated POSTs with the same form key return the original receipt.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${sessionUser.id} FOR UPDATE`;
      if (!locked.length) return { error: "Account not found. Sign in again before sending feedback." };
      const existing = await tx.feedback.findUnique({
        where: { userId_submissionKey: { userId: sessionUser.id, submissionKey: parsed.data.submissionKey } },
        select: { id: true },
      });
      if (existing) return { ok: true, feedbackId: existing.id };
      const [{ count }] = await tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM "Feedback"
        WHERE "userId" = ${sessionUser.id}
          AND "createdAt" > CURRENT_TIMESTAMP - (${FEEDBACK_WINDOW_MINUTES} * INTERVAL '1 minute')
      `;
      if (Number(count) >= FEEDBACK_WINDOW_LIMIT) {
        return { error: "You’ve sent 5 messages in 15 minutes. Please wait a little before sending another." };
      }
      const user = await tx.user.findUniqueOrThrow({
        where: { id: sessionUser.id },
        select: {
          id: true, name: true, email: true, role: true, platformAdmin: true,
          memberships: { where: { status: "APPROVED" }, select: { team: { select: { name: true } } } },
          competitionMemberships: { where: { status: "APPROVED" }, select: { competition: { select: { name: true } } } },
          judge: { select: { assignments: { where: { status: "APPROVED" }, select: { competition: { select: { name: true } } } } } },
          moderatorAccess: { select: { competition: { select: { name: true } } } },
        },
      });
      const context = [
        user.platformAdmin ? "Circuit tech admin" : "",
        user.memberships.length ? `Teams: ${user.memberships.map((m) => m.team.name).join(", ")}` : "",
        user.competitionMemberships.length ? `Competitions: ${user.competitionMemberships.map((m) => m.competition.name).join(", ")}` : "",
        user.judge?.assignments.length ? `Judging: ${user.judge.assignments.map((a) => a.competition.name).join(", ")}` : "",
        user.moderatorAccess.length ? `Moderator: ${user.moderatorAccess.map((a) => a.competition.name).join(", ")}` : "",
      ].filter(Boolean).join("\n");
      const feedback = await tx.feedback.create({
        data: {
          ...parsed.data, userId: user.id, submitterName: user.name, submitterEmail: user.email,
          accountRole: user.role, accountContext: context,
        },
        select: { id: true },
      });
      return { ok: true, feedbackId: feedback.id };
    });
  } catch {
    console.error("feedback_submission_unavailable");
    return { error: "We couldn’t confirm your message was saved. Please try again; retrying this form won’t create a duplicate." };
  }
  if (result.ok) revalidatePath("/ops/feedback");
  return result;
}

export async function updateFeedbackStatus(_prev: FeedbackState | undefined, form: FormData): Promise<FeedbackState> {
  const user = await requireUser();
  if (!user) return { error: "Sign in to manage feedback." };
  const id = form.get("feedbackId");
  const status = feedbackStatusSchema.safeParse(form.get("status"));
  if (typeof id !== "string" || !id || id.length > 100 || !status.success) return { error: "Choose a valid feedback status." };
  let result: FeedbackState;
  try {
    result = await prisma.$transaction(async (tx) => {
      const admins = await tx.$queryRaw<{ email: string }[]>`
        SELECT email FROM "User" WHERE id = ${user.id} AND "platformAdmin" = true FOR UPDATE
      `;
      if (!admins.length) return { error: "Only circuit tech admins can manage feedback." };
      const updated = await tx.feedback.updateMany({
        where: { id }, data: { status: status.data, statusUpdatedByEmail: admins[0].email },
      });
      return updated.count ? { ok: true, message: "Status saved." } : { error: "Feedback not found." };
    });
  } catch {
    console.error("feedback_status_update_unavailable");
    return { error: "Couldn’t save the status. Please try again." };
  }
  if (result.ok) revalidatePath("/ops/feedback");
  return result;
}
