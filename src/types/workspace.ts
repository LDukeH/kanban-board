export type WorkspaceRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  description?: string;
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

/** A user returned by the `GET /users/search` endpoint. */
export interface SearchedUser {
  id: string;
  email: string;
}
