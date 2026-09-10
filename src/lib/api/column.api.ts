import { api } from "./axios";
import type { Column } from "@/types/board";

interface ColumnApiResponse {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function mapColumn(raw: ColumnApiResponse): Column {
  return {
    id: raw.id,
    boardId: raw.board_id,
    name: raw.name,
    position: raw.position,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const getBoardColumns = async (boardId: string): Promise<Column[]> => {
  const response = await api.get<ColumnApiResponse[]>(
    `/boards/${boardId}/columns`,
  );
  return response.data.map(mapColumn);
};

export const createColumn = async (
  boardId: string,
  data: { name: string },
): Promise<Column> => {
  const response = await api.post<ColumnApiResponse>(
    `/boards/${boardId}/columns`,
    data,
  );
  return mapColumn(response.data);
};

export const updateColumn = async (
  columnId: string,
  data: { name?: string },
): Promise<Column> => {
  const response = await api.patch<ColumnApiResponse>(
    `/columns/${columnId}`,
    data,
  );
  return mapColumn(response.data);
};

export const updateColumnPosition = async (
  columnId: string,
  position: number,
): Promise<Column> => {
  const response = await api.patch<ColumnApiResponse>(
    `/columns/${columnId}/position`,
    { position },
  );
  return mapColumn(response.data);
};

export const deleteColumn = async (columnId: string): Promise<void> => {
  await api.delete(`/columns/${columnId}`);
};
