import { api } from "./axios";
import type { Label, TaskAssignee } from "@/types/board";

/**
 * Raw label shape returned by the Go API (snake_case).
 * The frontend uses camelCase, so we map at this API boundary.
 *
 * Reused by task.api.ts because the task-list endpoint embeds labels
 * using this exact shape.
 */
export interface LabelApiResponse {
  id: string;
  board_id: string;
  name: string;
  /** Hex color (e.g. "#e11941") or "" when unset. Always present in responses. */
  color: string;
  created_at: string;
  updated_at: string;
}

export interface AssigneeApiResponse {
  user_id: string;
  email: string;
}

export function mapLabel(raw: LabelApiResponse): Label {
  return {
    id: raw.id,
    boardId: raw.board_id,
    name: raw.name,
    color: raw.color,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function mapAssignee(raw: AssigneeApiResponse): TaskAssignee {
  return {
    user_id: raw.user_id,
    email: raw.email,
  };
}

export interface LabelCreateData {
  name: string;
  color: string;
}

export interface LabelUpdateData {
  name: string;
  color: string;
}

/** Board-scoped label collection. */
export const getBoardLabels = async (boardId: string): Promise<Label[]> => {
  const response = await api.get<LabelApiResponse[]>(
    `/boards/${boardId}/labels`,
  );
  return response.data.map(mapLabel);
};

export const getLabel = async (labelId: string): Promise<Label> => {
  const response = await api.get<LabelApiResponse>(`/labels/${labelId}`);
  return mapLabel(response.data);
};

export const createLabel = async (
  boardId: string,
  data: LabelCreateData,
): Promise<Label> => {
  const response = await api.post<LabelApiResponse>(
    `/boards/${boardId}/labels`,
    data,
  );
  return mapLabel(response.data);
};

/** Backend returns 204 No Content — no response body. */
export const updateLabel = async (
  labelId: string,
  data: LabelUpdateData,
): Promise<void> => {
  await api.patch(`/labels/${labelId}`, data);
};

/** Backend returns 204 No Content — no response body. */
export const deleteLabel = async (labelId: string): Promise<void> => {
  await api.delete(`/labels/${labelId}`);
};

/** Attaches a board label to a task. Backend expects { "label_id": "<uuid>" }. */
export const addLabelToTask = async (
  taskId: string,
  labelId: string,
): Promise<void> => {
  await api.post(`/tasks/${taskId}/labels`, { label_id: labelId });
};

/** Backend returns 204 No Content — no response body. */
export const removeLabelFromTask = async (
  taskId: string,
  labelId: string,
): Promise<void> => {
  await api.delete(`/tasks/${taskId}/labels/${labelId}`);
};
