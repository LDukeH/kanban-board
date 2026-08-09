import type { WorkspaceRole } from "@/types/workspace";

/** Human-readable (English) label for a workspace role. */
export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function roleLabel(role: WorkspaceRole): string {
  return WORKSPACE_ROLE_LABELS[role];
}

/**
 * The part of an email before the "@". Used as the display "handle",
 * e.g. `lelele1029@gmail.com` → `@lelele1029`.
 */
export function emailToHandle(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  return `@${localPart}`;
}

/** First character of the email, uppercased — used for the member avatar. */
export function emailInitial(email: string): string {
  return (email.charAt(0) || "?").toUpperCase();
}

/**
 * Deterministic gradient for a member avatar based on their user id/email.
 * Keeps an individual's avatar color stable across renders.
 */
export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const palettes = [
    "from-indigo-500 to-violet-600",
    "from-sky-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-500",
    "from-fuchsia-500 to-purple-600",
  ];
  const index = Math.abs(hash) % palettes.length;
  return palettes[index];
}