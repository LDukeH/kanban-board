import { api } from "./axios";
import type { Column } from "@/types/board";

interface ColumnApiResponse {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  /** Optimistic-concurrency version; optional only so a pre-OCC server still maps — treated as 1. */
  version?: number;
}

function mapColumn(raw: ColumnApiResponse): Column {
  return {
    id: raw.id,
    boardId: raw.board_id,
    name: raw.name,
    position: raw.position,
    // OCC version comes from the response; fallback 1 only guards a pre-OCC server.
    version: raw.version ?? 1,
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
  // OCC: rename carries the version read with the column; 409 means it changed underneath.
  data: { name?: string; version: number },
): Promise<Column> => {
  const response = await api.patch<ColumnApiResponse>(
    `/columns/${columnId}`,
    data,
  );
  return mapColumn(response.data);
};

export const updateColumnPosition = async (
  columnId: string,
  data: { position: number; version: number },
): Promise<Column> => {
  const response = await api.patch<ColumnApiResponse>(
    `/columns/${columnId}/position`,
    {
      position: data.position,
      version: data.version,
    },
  );
  return mapColumn(response.data);
};

export const deleteColumn = async (
  columnId: string,
  version: number,
): Promise<void> => {
  // OCC contract: DELETE /columns/{id}?version=N as a query parameter.
  await api.delete(`/columns/${columnId}`, { params: { version } });
};
