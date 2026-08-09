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

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  /**
   * Labels attached to this task. The board's task-list endpoint already
   * embeds these (board-scoped), so we display them directly without
   * additional per-task requests.
   */
  labels?: Label[];
}
