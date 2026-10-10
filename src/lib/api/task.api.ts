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
import type { Task, TaskAssignee, TaskPriority } from "@/types/board";

interface TaskApiResponse {
  id: string;
  column_id: string;
  title: string;
  description?: TaskDescription | string | null;
  position: number;
  version?: number;
  created_at: string;
  updated_at: string;
  // Planning metadata added by migration 019; optional so a pre-019 server cannot break the mapper.
  priority?: TaskPriority;
  due_date?: string | null;
  completed?: boolean;
  labels?: LabelApiResponse[] | null;
  assignees?: AssigneeApiResponse[] | null;
}

export interface CreateTaskData {
  title: string;
  description?: TaskDescription;
  priority?: TaskPriority;
  /** "YYYY-MM-DD". Omit or send null on create — both store NULL. */
  dueDate?: string | null;
  completed?: boolean;
}

export interface UpdateTaskData {
  title?: string;
  description?: TaskDescription;
  priority?: TaskPriority;
  /** Tri-state on the backend: "YYYY-MM-DD" sets it, null clears it, and omitting the key leaves the stored value unchanged. */
  dueDate?: string | null;
  completed?: boolean;
  /** OCC version read from cache; required by PATCH /tasks/{id}. */
  version: number;
}

/** Maps the camelCase request types onto the snake_case body the API expects (`dueDate` -> `due_date`). */
function toTaskPayload(
  data: CreateTaskData | UpdateTaskData,
  version?: number,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (version !== undefined) payload.version = version;
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.priority !== undefined) payload.priority = data.priority;
  if (data.dueDate !== undefined) payload.due_date = data.dueDate;
  if (data.completed !== undefined) payload.completed = data.completed;
  if ("version" in data && data.version !== undefined)
    payload.version = data.version;
  return payload;
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
    version: raw.version ?? 1,
    createdAt: raw.created_at,
    // The backend guarantees these three keys; the fallbacks only guard against a pre-019 server so the UI degrades to the neutral values instead of undefined.
    priority: raw.priority ?? "none",
    dueDate: raw.due_date ?? null,
    completed: raw.completed ?? false,
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
    toTaskPayload(data),
  );
  return mapTask(response.data);
};

export const updateTask = async (
  taskId: string,
  data: UpdateTaskData & { version: number },
): Promise<void> => {
  await api.patch(`/tasks/${taskId}`, toTaskPayload(data, data.version));
};

/** 200 response of PATCH /tasks/{id}/position — the authoritative post-move state, version included. */
export interface TaskMoveResponse {
  id: string;
  column_id: string;
  position: number;
  version: number;
}

export const updateTaskPosition = async (
  taskId: string,
  data: { columnId: string; position: number; version: number },
): Promise<TaskMoveResponse> => {
  const response = await api.patch<TaskMoveResponse>(`/tasks/${taskId}/position`, {
    column_id: data.columnId,
    position: data.position,
    version: data.version,
  });
  return response.data;
};

export const deleteTask = async (taskId: string, version: number): Promise<void> => {
  await api.delete(`/tasks/${taskId}`, { params: { version } });
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

/** Resolves the owning board through the normal board/column/task endpoints, since notification payloads carry only a task id. Session-cached. */
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
