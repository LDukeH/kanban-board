import { api } from "./axios";
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types/workspace";

/**
 * The backend returns entities with snake_case fields
 * (e.g. `user_id`, `workspace_id`, `created_at`). Normalize them to the
 * camelCase shape the frontend types expect, at this API boundary.
 */
interface WorkspaceApiResponse {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

function mapWorkspace(raw: WorkspaceApiResponse): Workspace {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

interface WorkspaceMemberApiResponse {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMember["role"];
  email: string;
  created_at: string;
  updated_at: string;
}

function mapMember(raw: WorkspaceMemberApiResponse): WorkspaceMember {
  return {
    id: raw.id,
    workspaceId: raw.workspace_id,
    userId: raw.user_id,
    role: raw.role,
    email: raw.email,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const getWorkspaces = async (): Promise<Workspace[]> => {
  const response = await api.get<WorkspaceApiResponse[]>("/workspaces");
  return response.data.map(mapWorkspace);
};

export const createWorkspace = async (data: {
  name: string;
  description?: string;
}): Promise<Workspace> => {
  const response = await api.post<WorkspaceApiResponse>("/workspaces", data);
  return mapWorkspace(response.data);
};

export const updateWorkspace = async (
  workspaceId: string,
  data: { name?: string; description?: string },
): Promise<Workspace> => {
  const response = await api.patch<WorkspaceApiResponse>(
    `/workspaces/${workspaceId}`,
    data,
  );
  return mapWorkspace(response.data);
};

export const deleteWorkspace = async (workspaceId: string): Promise<void> => {
  await api.delete(`/workspaces/${workspaceId}`);
};

export const getWorkspaceMembers = async (
  workspaceId: string,
): Promise<WorkspaceMember[]> => {
  const response = await api.get<WorkspaceMemberApiResponse[]>(
    `/workspaces/${workspaceId}/members`,
  );
  return response.data.map(mapMember);
};

export const createMembership = async (
  workspaceId: string,
  data: { email: string; role: WorkspaceRole },
): Promise<WorkspaceMember> => {
  const response = await api.post<WorkspaceMemberApiResponse>(
    `/workspaces/${workspaceId}/members`,
    data,
  );
  return mapMember(response.data);
};

export const changeMemberRole = async (
  workspaceId: string,
  membershipId: string,
  role: WorkspaceRole,
): Promise<WorkspaceMember> => {
  const response = await api.patch<WorkspaceMemberApiResponse>(
    `/workspaces/${workspaceId}/members/${membershipId}`,
    { role },
  );
  return mapMember(response.data);
};

export const removeMember = async (
  workspaceId: string,
  membershipId: string,
): Promise<void> => {
  await api.delete(`/workspaces/${workspaceId}/members/${membershipId}`);
};

/**
 * Remove the current user's membership via the dedicated
 * `DELETE /workspaces/{workspaceID}/memberships` route. Unlike removing
 * another member (`removeMember`), this only ever targets the authenticated
 * user, so no membership id is needed. The backend rejects owners — they must
 * transfer ownership or delete the workspace before they can leave.
 */
export const leaveWorkspace = async (workspaceId: string): Promise<void> => {
  await api.delete(`/workspaces/${workspaceId}/memberships`);
};

/**
 * Transfer workspace ownership to another member. The backend performs the
 * demote (old owner → member) / promote (target → owner) transactionally in a
 * single request and returns `204 No Content`. Only `204` is treated as
 * success — any other status means the transfer did not happen.
 */
export const transferWorkspaceOwnership = async (
  workspaceId: string,
  newOwnerId: string,
): Promise<void> => {
  const response = await api.post(
    `/workspaces/${workspaceId}/transfer-ownership`,
    { new_owner_id: newOwnerId },
  );
  // The backend returns 204 No Content with no body. Treat only that as success.
  if (response.status !== 204) {
    throw new Error(`Unexpected status ${response.status}`);
  }
};
