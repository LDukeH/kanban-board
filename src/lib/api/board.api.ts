import { api } from "./axios";
import type { Board } from "@/types/board";

export const getBoards = async (workspaceId: string): Promise<Board[]> => {
  const response = await api.get<Board[]>(`/workspaces/${workspaceId}/boards`);
  return response.data;
};

export const createBoard = async (
  workspaceId: string,
  data: { name: string; description?: string },
): Promise<Board> => {
  const response = await api.post<Board>(
    `/workspaces/${workspaceId}/boards`,
    data,
  );
  return response.data;
};
