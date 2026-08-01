import { api } from "./axios";
import type { Workspace, WorkspaceMember } from "@/types/workspace";

export const getWorkspaces = async (): Promise<Workspace[]> => {
  const response = await api.get<Workspace[]>("/workspaces");
  return response.data;
};

export const createWorkspace = async (data: {
  name: string;
  description?: string;
}): Promise<Workspace> => {
  const response = await api.post<Workspace>("/workspaces", data);
  return response.data;
};

export const getWorkspaceMembers = async (
  workspaceId: string,
): Promise<WorkspaceMember[]> => {
  const response = await api.get<WorkspaceMember[]>(
    `/workspaces/${workspaceId}/members`,
  );
  return response.data;
};
