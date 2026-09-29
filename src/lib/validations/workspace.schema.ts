import { z } from "zod";

/** Backend caps descriptions at 2000 *bytes* (docs/api/workspace-description-frontend-handoff.md), so the guard measures UTF-8 length. */
export const WORKSPACE_DESCRIPTION_MAX_BYTES = 2000;

/** Textarea hard stop; equals the byte limit for ASCII and only bites on multi-byte input. */
export const WORKSPACE_DESCRIPTION_MAX_CHARS = 2000;

/** UTF-8 byte length of `value` (TextEncoder is a global in Node and browsers). */
export function descriptionByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** No minimum: the backend reads `""` as "clear this description", and the count is measured after trim. */
export const workspaceDescriptionSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (descriptionByteLength(value) > WORKSPACE_DESCRIPTION_MAX_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: `Workspace descriptions are limited to ${WORKSPACE_DESCRIPTION_MAX_BYTES} bytes.`,
      });
    }
  });

/** Returns a user-facing message when the description is over the byte limit, otherwise null. */
export function validateWorkspaceDescription(value: string): string | null {
  const result = workspaceDescriptionSchema.safeParse(value);
  if (result.success) return null;
  const message = result.error.issues[0]?.message;
  return message ? message : "Invalid workspace description.";
}

/** Never returns `undefined`: `""` clears the description, but an omitted key would leave the saved one unchanged. */
export function normalizeWorkspaceDescription(value: string): string {
  return value.trim();
}