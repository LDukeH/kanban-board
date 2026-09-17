import { describe, expect, it } from "vitest";
import {
  COMMENT_CONTENT_MAX_LENGTH,
  commentContentSchema,
  validateCommentContent,
} from "@/lib/validations/comment.schema";

describe("commentContentSchema", () => {
  it("accepts a single non-whitespace character", () => {
    expect(commentContentSchema.safeParse("a").success).toBe(true);
  });

  it("rejects whitespace-only content", () => {
    expect(commentContentSchema.safeParse("   ").success).toBe(false);
    expect(commentContentSchema.safeParse("\t\n ").success).toBe(false);
  });

  it("ignores leading and trailing whitespace", () => {
    expect(commentContentSchema.safeParse("  hello  ").success).toBe(true);
  });

  it("enforces the exact 5000 trimmed-character limit", () => {
    expect(commentContentSchema.safeParse("a".repeat(COMMENT_CONTENT_MAX_LENGTH)).success).toBe(true);
    expect(commentContentSchema.safeParse("a".repeat(COMMENT_CONTENT_MAX_LENGTH + 1)).success).toBe(false);
  });

  it("allows newlines and tabs inside the content", () => {
    expect(commentContentSchema.safeParse("line one\nline two\ttab").success).toBe(true);
  });
});

describe("validateCommentContent", () => {
  it("returns null for valid content", () => {
    expect(validateCommentContent("hello")).toBeNull();
    expect(validateCommentContent("  hello  ")).toBeNull();
  });

  it("returns a useful message for empty content", () => {
    const message = validateCommentContent("   ");
    expect(message).not.toBeNull();
    expect(message).toContain("empty");
  });

  it("returns a useful message when over the limit", () => {
    const message = validateCommentContent("a".repeat(COMMENT_CONTENT_MAX_LENGTH + 1));
    expect(message).not.toBeNull();
    expect(message).toContain(String(COMMENT_CONTENT_MAX_LENGTH));
  });
});