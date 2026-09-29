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

export interface Task {
  id: string;
  columnId: string;
  title: string;
  // Canonical format is a Tiptap JSON document ({ type: "doc", ... }) persisted as PostgreSQL JSONB.
  // Kept as `TaskDescription | string` during the backend transition so legacy plain-text rows keep rendering.
  description?: TaskDescription | string;
  position: number;
  createdAt: string;
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
