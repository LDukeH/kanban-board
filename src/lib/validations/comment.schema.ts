import { z } from "zod";

/** Backend contract: comment content must be 1-5000 characters after trimming. */
export const COMMENT_CONTENT_MAX_LENGTH = 5000;

export const commentContentSchema = z
  .string()
  .trim()
  .min(1, "Comment cannot be empty.")
  .max(
    COMMENT_CONTENT_MAX_LENGTH,
    `Comments are limited to ${COMMENT_CONTENT_MAX_LENGTH} characters.`,
  );

/**
/** User-facing message when the comment is empty or over the limit, otherwise null. */
export function validateCommentContent(content: string): string | null {
  const result = commentContentSchema.safeParse(content);
  if (result.success) return null;
  const message = result.error.issues[0]?.message;
  return message ? message : "Invalid comment.";
}
