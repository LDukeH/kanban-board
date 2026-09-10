import { api } from "./axios";
import type { Board } from "@/types/board";

interface BoardApiResponse {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

function mapBoard(raw: BoardApiResponse): Board {
  return {
    id: raw.id,
    workspaceId: raw.workspace_id,
    name: raw.name,
    description: raw.description,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const getBoards = async (workspaceId: string): Promise<Board[]> => {
  const response = await api.get<BoardApiResponse[]>(
    `/workspaces/${workspaceId}/boards`,
  );
  return response.data.map(mapBoard);
};

export const getBoard = async (boardId: string): Promise<Board> => {
  const response = await api.get<BoardApiResponse>(`/boards/${boardId}`);
  return mapBoard(response.data);
};

export const createBoard = async (
  workspaceId: string,
  data: { name: string; description?: string },
): Promise<Board> => {
  const response = await api.post<BoardApiResponse>(
    `/workspaces/${workspaceId}/boards`,
    data,
  );
  return mapBoard(response.data);
};

export const updateBoard = async (
  boardId: string,
  data: { name?: string; description?: string },
): Promise<Board> => {
  const response = await api.patch<BoardApiResponse>(
    `/boards/${boardId}`,
    data,
  );
  return mapBoard(response.data);
};

export const deleteBoard = async (boardId: string): Promise<void> => {
  await api.delete(`/boards/${boardId}`);
};
