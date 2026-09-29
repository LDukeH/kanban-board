import { api } from "./axios";
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types/workspace";

interface WorkspaceApiResponse {
  id: string;
  name: string;
  // The backend always sends a plain string (`""` when unset); nullable here so a row predating the field cannot leak `undefined`.
  description?: string | null;
  created_at: string;
  updated_at: string;
}

function mapWorkspace(raw: WorkspaceApiResponse): Workspace {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
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

/** `GET /workspaces/{workspaceID}` — single workspace, including `description`. */
export const getWorkspace = async (workspaceId: string): Promise<Workspace> => {
  const response = await api.get<WorkspaceApiResponse>(
    `/workspaces/${workspaceId}`,
  );
  return mapWorkspace(response.data);
};

export const createWorkspace = async (data: {
  name: string;
  description?: string;
}): Promise<Workspace> => {
  const response = await api.post<WorkspaceApiResponse>("/workspaces", data);
  return mapWorkspace(response.data);
};

// `name` is still mandatory on the wire (the backend 400s without it), so a description-only edit must resend it.
// `description` distinguishes a value (set), `""` (clear) and omitted (leave unchanged).
// Only the owner may patch, and the backend reports a non-owner as 500 rather than 403, so the UI gates on the role instead.
export const updateWorkspace = async (
  workspaceId: string,
  data: { name: string; description?: string },
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

export const leaveWorkspace = async (workspaceId: string): Promise<void> => {
  await api.delete(`/workspaces/${workspaceId}/memberships`);
};

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
