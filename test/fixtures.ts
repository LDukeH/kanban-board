import type { Board, Column, Comment, Label, Task, TaskAssignee } from "@/types/board";

/**
 * Minimal typed domain fixtures shared by multiple suites. Fixtures stay
 * explicit and small; factory helpers return fresh objects every call so tests
 * can never accidentally share mutable state.
 */

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    columnId: "col-1",
    title: "Sample task",
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    labels: [],
    assignees: [],
    ...overrides,
  };
}

export function makeAssignee(overrides: Partial<TaskAssignee> = {}): TaskAssignee {
  return { user_id: "user-1", email: "user@example.com", ...overrides };
}

export function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: "label-1",
    boardId: "board-1",
    name: "Bug",
    color: "#e11941",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: "col-1",
    boardId: "board-1",
    name: "To Do",
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: "board-1",
    workspaceId: "workspace-1",
    name: "Roadmap",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "comment-1",
    taskId: "task-1",
    authorId: "user-1",
    authorEmail: "user@example.com",
    content: "A comment",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}