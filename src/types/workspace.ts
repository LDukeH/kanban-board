export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  // Plain text, never null: a workspace created without a description reads back as `""` (normalized in the API mapper).
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchedUser {
  id: string;
  email: string;
}

/** Only a `pending` invitation may be accepted, declined or cancelled; accepting creates the membership in the same transaction. */
export type WorkspaceInvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  inviteeUserId: string;
  invitedByUserId: string;
  status: WorkspaceInvitationStatus;
  // Live-API display convenience, not part of the documented shape; consumers must tolerate its absence and fall back to `inviteeUserId`.
  inviteeEmail?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
