import { api } from "./axios";
import {
  mapAssignee,
  mapLabel,
  type AssigneeApiResponse,
  type LabelApiResponse,
} from "./label.api";
import { getBoardColumns } from "./column.api";
import { getBoards } from "./board.api";
import { getWorkspaces } from "./workspace.api";
import { isTaskDescriptionDoc, type TaskDescription } from "@/lib/description";
import type { Task, TaskAssignee } from "@/types/board";

interface TaskApiResponse {
  id: string;
  column_id: string;
  title: string;
  description?: TaskDescription | string | null;
  position: number;
  created_at: string;
  updated_at: string;
  labels?: LabelApiResponse[] | null;
  assignees?: AssigneeApiResponse[] | null;
}

export interface CreateTaskData {
  title: string;
  description?: TaskDescription;
}

export interface UpdateTaskData {
  title?: string;
  description?: TaskDescription;
}

function normalizeDescription(
  raw: TaskDescription | string | null | undefined,
): TaskDescription | string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "string") return raw;
  if (isTaskDescriptionDoc(raw)) return raw;
  return undefined;
}

function mapTask(raw: TaskApiResponse): Task {
  return {
    id: raw.id,
    columnId: raw.column_id,
    title: raw.title,
    description: normalizeDescription(raw.description),
    position: raw.position,
    createdAt: raw.created_at,
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
  data: CreateTaskData,
): Promise<Task> => {
  const response = await api.post<TaskApiResponse>(
    `/columns/${columnId}/tasks`,
    data,
  );
  return mapTask(response.data);
};

export const updateTask = async (
  taskId: string,
  data: UpdateTaskData,
): Promise<void> => {
  await api.patch(`/tasks/${taskId}`, data);
};

export const updateTaskPosition = async (
  taskId: string,
  data: { columnId: string; position: number },
): Promise<void> => {
  await api.patch(`/tasks/${taskId}/position`, {
    column_id: data.columnId,
    position: data.position,
  });
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
};

export const getTaskAssignees = async (
  taskId: string,
): Promise<TaskAssignee[]> => {
  const response = await api.get<TaskAssignee[]>(`/tasks/${taskId}/users`);
  return response.data;
};
export const assignUserToTask = async (
  taskId: string,
  userId: string,
): Promise<void> => {
  await api.post(`/tasks/${taskId}/users`, { user_id: userId });
};
export const unassignUserFromTask = async (
  taskId: string,
  userId: string,
): Promise<void> => {
  await api.delete(`/tasks/${taskId}/users`, { data: { user_id: userId } });
};

/** Session-scoped cache: taskId -> owning boardId (undefined = unresolvable). */
const taskBoardCache = new Map<string, string | undefined>();

/**
 * Resolve the board that owns a task through the normal board/column/task
 * endpoints (notification payloads carry only a task id). Session-cached.
 */
export const findBoardIdForTask = async (
  taskId: string,
): Promise<string | undefined> => {
  if (taskBoardCache.has(taskId)) {
    return taskBoardCache.get(taskId);
  }

  try {
    const workspaces = await getWorkspaces();
    for (const workspace of workspaces) {
      const boards = await getBoards(workspace.id);
      for (const board of boards) {
        const columns = await getBoardColumns(board.id);
        const taskLists = await Promise.all(
          columns.map((column) => getColumnTasks(column.id)),
        );
        if (
          taskLists.some((tasks) =>
            tasks.some((task) => task.id === taskId),
          )
        ) {
          taskBoardCache.set(taskId, board.id);
          return board.id;
        }
      }
    }
  } catch {
    // Treat any failure as unresolvable.
  }

  taskBoardCache.set(taskId, undefined);
  return undefined;
};
