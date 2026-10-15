import { z } from "zod";

export const FEEDBACK_CATEGORIES = {
  FEEDBACK: "Feedback",
  QUESTION: "Question",
  COMMENT: "Comment",
  CONCERN: "Concern",
} as const;

export const FEEDBACK_STATUSES = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
} as const;

export const FEEDBACK_MESSAGE_LIMIT = 5000;
export const FEEDBACK_WINDOW_MINUTES = 15;
export const FEEDBACK_WINDOW_LIMIT = 5;

// Store a local pathname only. Query strings/fragments can contain private codes
// or OAuth state; never keep them as feedback context or render arbitrary URLs.
export function feedbackPagePath(value: unknown): string {
  if (typeof value !== "string") return "";
  const path = value.split(/[?#]/, 1)[0];
  return /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(path) && path.length <= 500 ? path : "";
}

export const feedbackSchema = z.object({
  submissionKey: z.string().uuid("Refresh this page and try again."),
  category: z.enum(["FEEDBACK", "QUESTION", "COMMENT", "CONCERN"], { error: "Choose a feedback type." }),
  message: z.string().trim().min(1, "Enter your feedback or question.").max(FEEDBACK_MESSAGE_LIMIT, "Keep your message to 5,000 characters or fewer."),
  pagePath: z.unknown().transform(feedbackPagePath),
});

export const feedbackStatusSchema = z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]);

export type FeedbackState = { error?: string; ok?: boolean; message?: string; feedbackId?: string };
