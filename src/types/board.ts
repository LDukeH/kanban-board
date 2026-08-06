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

export interface Task {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}
