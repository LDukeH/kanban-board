import { api } from "./axios";
import type { Task } from "@/types/board";

/**
 * Raw task shape returned by the Go API (snake_case).
 * The frontend uses camelCase, so we map at this API boundary.
 */
interface TaskApiResponse {
  id: string;
  column_id: string;
  title: string;
  description?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

function mapTask(raw: TaskApiResponse): Task {
  return {
    id: raw.id,
    columnId: raw.column_id,
    title: raw.title,
    description: raw.description ?? undefined,
    position: raw.position,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const getColumnTasks = async (columnId: string): Promise<Task[]> => {
  const response = await api.get<TaskApiResponse[]>(
    `/columns/${columnId}/tasks`,
  );
  return response.data.map(mapTask);
};

export const createTask = async (
  columnId: string,
  data: { title: string; description?: string },
): Promise<Task> => {
  const response = await api.post<TaskApiResponse>(
    `/columns/${columnId}/tasks`,
    data,
  );
  return mapTask(response.data);
};

/** Backend returns 204 No Content — no response body. */
export const updateTask = async (
  taskId: string,
  data: { title?: string; description?: string },
): Promise<void> => {
  await api.patch(`/tasks/${taskId}`, data);
};

/** Backend returns 204 No Content — no response body. */
export const updateTaskPosition = async (
  taskId: string,
  data: { columnId: string; position: number },
): Promise<void> => {
  await api.patch(`/tasks/${taskId}/position`, {
    column_id: data.columnId,
    position: data.position,
  });
};

/** Backend returns 204 No Content — no response body. */
export const deleteTask = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
};
