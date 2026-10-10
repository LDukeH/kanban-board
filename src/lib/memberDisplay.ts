import type { WorkspaceRole } from "@/types/workspace";
import { hashString } from "@/lib/colors";

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function roleLabel(role: WorkspaceRole): string {
  return WORKSPACE_ROLE_LABELS[role];
}

export function emailToHandle(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  return `@${localPart}`;
}

export function emailInitial(email: string): string {
  return (email.charAt(0) || "?").toUpperCase();
}

const AVATAR_PALETTES = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-600",
] as const;

export function avatarGradient(seed: string): string {
  return AVATAR_PALETTES[hashString(seed) % AVATAR_PALETTES.length];
}

/**
 * Stable avatar color key for a person: email is the identity users recognize
 * (and the only key every surface has — summaries/comments group by email),
 * while user ids differ per auth provider and would tint the same person
 * differently across surfaces.
 */
export function avatarSeed(input: { email?: string | null }): string {
  return input.email?.trim().toLowerCase() ?? "";
}
