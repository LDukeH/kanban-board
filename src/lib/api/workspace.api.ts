import { api } from "./axios";
import type { Workspace, WorkspaceMember } from "@/types/workspace";

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
  created_at: string;
  updated_at: string;
}

function mapMember(raw: WorkspaceMemberApiResponse): WorkspaceMember {
  return {
    id: raw.id,
    workspaceId: raw.workspace_id,
    userId: raw.user_id,
    role: raw.role,
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

export const getWorkspaceMembers = async (
  workspaceId: string,
): Promise<WorkspaceMember[]> => {
  const response = await api.get<WorkspaceMemberApiResponse[]>(
    `/workspaces/${workspaceId}/members`,
  );
  return response.data.map(mapMember);
};
