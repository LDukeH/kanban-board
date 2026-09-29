import { describe, expect, it } from "vitest";
import {
  WORKSPACE_DESCRIPTION_MAX_BYTES,
  descriptionByteLength,
  normalizeWorkspaceDescription,
  validateWorkspaceDescription,
  workspaceDescriptionSchema,
} from "@/lib/validations/workspace.schema";

/** "€" encodes to three UTF-8 bytes, so it exposes character/byte confusion. */
const EURO = "€";
const EURO_BYTE_LENGTH = 3;

describe("descriptionByteLength", () => {
  it("counts one byte per ASCII character", () => {
    expect(descriptionByteLength("hello")).toBe(5);
  });

  it("counts UTF-8 bytes for multi-byte characters", () => {
    expect(descriptionByteLength(EURO)).toBe(EURO_BYTE_LENGTH);
    expect(descriptionByteLength("🚀")).toBe(4);
  });

  it("counts an empty string as zero bytes", () => {
    expect(descriptionByteLength("")).toBe(0);
  });
});

describe("workspaceDescriptionSchema", () => {
  it("accepts an empty description, which clears the stored value", () => {
    expect(workspaceDescriptionSchema.safeParse("").success).toBe(true);
  });

  it("accepts whitespace-only content after trimming", () => {
    expect(workspaceDescriptionSchema.safeParse("  \n\t ").success).toBe(true);
  });

  it("accepts exactly the byte limit of ASCII text", () => {
    const atLimit = "a".repeat(WORKSPACE_DESCRIPTION_MAX_BYTES);
    expect(descriptionByteLength(atLimit)).toBe(WORKSPACE_DESCRIPTION_MAX_BYTES);
    expect(workspaceDescriptionSchema.safeParse(atLimit).success).toBe(true);
  });

  it("rejects ASCII text one byte over the limit", () => {
    const overLimit = "a".repeat(WORKSPACE_DESCRIPTION_MAX_BYTES + 1);
    expect(workspaceDescriptionSchema.safeParse(overLimit).success).toBe(false);
  });

  it("rejects multi-byte text that fits the limit in characters but not in bytes", () => {
    // 667 * 3 = 2001 bytes in only 667 characters: a character-based guard
    // would wrongly accept this and let the backend answer 400.
    const sneaky = EURO.repeat(667);
    expect(sneaky.length).toBeLessThan(WORKSPACE_DESCRIPTION_MAX_BYTES);
    expect(descriptionByteLength(sneaky)).toBe(WORKSPACE_DESCRIPTION_MAX_BYTES + 1);
    expect(workspaceDescriptionSchema.safeParse(sneaky).success).toBe(false);
  });

  it("accepts multi-byte text that is the last whole value under the byte limit", () => {
    // 666 * 3 = 1998 bytes.
    const fits = EURO.repeat(666);
    expect(descriptionByteLength(fits)).toBeLessThanOrEqual(
      WORKSPACE_DESCRIPTION_MAX_BYTES,
    );
    expect(workspaceDescriptionSchema.safeParse(fits).success).toBe(true);
  });

  it("measures bytes after trimming, so padding does not count", () => {
    const atLimit = "a".repeat(WORKSPACE_DESCRIPTION_MAX_BYTES);
    expect(workspaceDescriptionSchema.safeParse(`   ${atLimit}   `).success).toBe(
      true,
    );
  });
});

describe("validateWorkspaceDescription", () => {
  it("returns null for a description within the byte limit", () => {
    expect(validateWorkspaceDescription("Platform roadmap")).toBeNull();
    expect(validateWorkspaceDescription("")).toBeNull();
  });

  it("returns a message naming the byte limit when over", () => {
    const message = validateWorkspaceDescription(
      "a".repeat(WORKSPACE_DESCRIPTION_MAX_BYTES + 1),
    );
    expect(message).not.toBeNull();
    expect(message).toContain(String(WORKSPACE_DESCRIPTION_MAX_BYTES));
    expect(message).toContain("bytes");
  });
});

describe("normalizeWorkspaceDescription", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeWorkspaceDescription("  hello  ")).toBe("hello");
  });

  it("returns an empty string for a blank field so the backend clears it", () => {
    // The backend treats "" as "clear" and an omitted key as "unchanged", so
    // this must never degrade to undefined.
    expect(normalizeWorkspaceDescription("")).toBe("");
    expect(normalizeWorkspaceDescription("   \n\t ")).toBe("");
  });

  it("never returns undefined", () => {
    expect(normalizeWorkspaceDescription("")).not.toBeUndefined();
  });
});