import { api } from "./axios";
import {
  mapAssignee,
  mapLabel,
  type AssigneeApiResponse,
  type LabelApiResponse,
} from "./label.api";
import type { Task, TaskAssignee } from "@/types/board";

/**
 * Raw task shape returned by the Go API (snake_case).
 * The frontend uses camelCase, so we map at this API boundary.
 *
 * Note: the backend's `GetTasksByColumnID` already joins and embeds each
 * task's board labels (same shape as `LabelApiResponse`), so we map them
 * here instead of issuing per-task label requests.
 */
interface TaskApiResponse {
  id: string;
  column_id: string;
  title: string;
  description?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  labels?: LabelApiResponse[] | null;
  assignees?: AssigneeApiResponse[] | null;
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
    labels: (raw.labels ?? []).map(mapLabel),
    assignees: (raw.assignees ?? []).map(mapAssignee),
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

/**
 * Lists the users currently assigned to a task.
 * `GET /tasks/{taskID}/users` → UsersTaskResponse[] (`{ email, user_id }`).
 */
export const getTaskAssignees = async (
  taskId: string,
): Promise<TaskAssignee[]> => {
  const response = await api.get<TaskAssignee[]>(`/tasks/${taskId}/users`);
  return response.data;
};

/** Assigns a workspace member to a task by their user id. Body: `{ user_id }`. */
export const assignUserToTask = async (
  taskId: string,
  userId: string,
): Promise<void> => {
  await api.post(`/tasks/${taskId}/users`, { user_id: userId });
};

/** Removes a user from a task by their user id. Body: `{ user_id }`. */
export const unassignUserFromTask = async (
  taskId: string,
  userId: string,
): Promise<void> => {
  await api.delete(`/tasks/${taskId}/users`, { data: { user_id: userId } });
};
