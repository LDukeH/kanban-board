import type { TaskDescription } from "@/lib/description";

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  /** Optimistic concurrency version, always >= 1. Read from cache, send back on mutate, overwrite from response. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  /** Hex color (e.g. "#e11941") or "" when no color is set. Always present in the backend response. */
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  user_id: string;
  email: string;
}

/** Closed set of task priorities, mirroring the backend's tasks_priority_check constraint. */
export type TaskPriority = "none" | "low" | "medium" | "high";

/** The allowed priority values, in ascending order, for pickers and filters. */
export const TASK_PRIORITIES: readonly TaskPriority[] = [
  "none",
  "low",
  "medium",
  "high",
];

export interface Task {
  id: string;
  columnId: string;
  title: string;
  // Canonical format is a Tiptap JSON document ({ type: "doc", ... }) persisted as PostgreSQL JSONB.
  description?: TaskDescription | string;
  position: number;
  /** Optimistic concurrency version, always >= 1. Read from cache, send back on mutate, overwrite from response. */
  version: number;
  createdAt: string;
  /** Always present in backend responses; defaults to "none". */
  priority: TaskPriority;
  /** Calendar due date as "YYYY-MM-DD", or null when none is set. Never an ISO timestamp. */
  dueDate: string | null;
  /** Always present in backend responses; defaults to false. */
  completed: boolean;
  labels?: Label[];
  assignees?: TaskAssignee[];
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  authorEmail: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
