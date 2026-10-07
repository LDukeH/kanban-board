import {
  descriptionsEqual,
  isTaskDescriptionDoc,
  textToTaskDescription,
  type TaskDescription,
} from "@/lib/description";
import type { Task, TaskPriority } from "@/types/board";

/**
 * Pure draft state for `EditTaskDialog` (no React, no hooks, no JSX).
 * Moved verbatim from the dialog: one [Save] PATCHes title + description +
 * metadata together, and closing while dirty flush-saves first.
 */

export interface TaskDraft {
  title: string;
  description: TaskDescription | undefined;
  priority: TaskPriority;
  /** Empty string is the draft form of "no due date"; "" and null are equivalent. */
  dueDate: string;
  completed: boolean;
}

export interface TaskUpdatePayload {
  title: string;
  description: TaskDescription | undefined;
  priority: TaskPriority;
  /** "" means the user cleared the date, so send null to clear it. */
  dueDate: string | null;
  completed: boolean;
}

export type TaskCloseAction = "close" | "flush-save" | "await-save";

export function normalizeSnapshotDescription(
  description: TaskDescription | string | undefined,
): TaskDescription | undefined {
  if (!description) return undefined;
  if (typeof description === "string") {
    return description.trim() ? textToTaskDescription(description) : undefined;
  }
  if (isTaskDescriptionDoc(description)) return description;
  return undefined;
}

export function createTaskDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    description: normalizeSnapshotDescription(task.description),
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    completed: task.completed,
  };
}

export function savedTaskDraft(task: Task): TaskDraft {
  return createTaskDraft(task);
}

export function isTaskDraftDirty(draft: TaskDraft, saved: Task): boolean {
  const savedDraft = savedTaskDraft(saved);
  return (
    draft.title !== savedDraft.title ||
    !descriptionsEqual(draft.description, savedDraft.description) ||
    draft.priority !== savedDraft.priority ||
    draft.dueDate !== savedDraft.dueDate ||
    draft.completed !== savedDraft.completed
  );
}

export function validateTaskDraft(draft: TaskDraft): string | null {
  if (!draft.title.trim()) return "Task title is required.";
  return null;
}

export function buildTaskUpdatePayload(draft: TaskDraft): TaskUpdatePayload {
  return {
    title: draft.title.trim(),
    description: draft.description,
    priority: draft.priority,
    dueDate: draft.dueDate || null,
    completed: draft.completed,
  };
}

export function resolveCloseAction(state: {
  hasPendingSave: boolean;
  isDirty: boolean;
}): TaskCloseAction {
  // A save is already in flight, so a close attempt awaits it and then closes only on success.
  if (state.hasPendingSave) return "await-save";
  // ESC / overlay / wrapper Close flush-saves first instead of discarding the draft.
  if (state.isDirty) return "flush-save";
  return "close";
}
