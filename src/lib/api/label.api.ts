import { api } from "./axios";
import type { Label, TaskAssignee } from "@/types/board";

export interface LabelApiResponse {
  id: string;
  board_id: string;
  name: string;
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

export const updateLabel = async (
  labelId: string,
  data: LabelUpdateData,
): Promise<void> => {
  await api.patch(`/labels/${labelId}`, data);
};

export const deleteLabel = async (labelId: string): Promise<void> => {
  await api.delete(`/labels/${labelId}`);
};
export const addLabelToTask = async (
  taskId: string,
  labelId: string,
): Promise<void> => {
  await api.post(`/tasks/${taskId}/labels`, { label_id: labelId });
};

export const removeLabelFromTask = async (
  taskId: string,
  labelId: string,
): Promise<void> => {
  await api.delete(`/tasks/${taskId}/labels/${labelId}`);
};
