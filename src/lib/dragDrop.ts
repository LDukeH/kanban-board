import type { Column, Task } from "@/types/board";
import type { DragDropManager } from "@dnd-kit/dom";
import { isSortable } from "@dnd-kit/dom/sortable";

/**
 * Pure drag-and-drop ordering helpers shared by the board drop handler and the
 * optimistic cache updates in `useBoard` / `useColumnTasks`. Keeping the
 * reorder math in one place guarantees the UI, the optimistic cache and the
 * final PATCH always agree on positions.
 */

/** Return a fresh copy of `tasks` sorted by ascending `position`. */
export function orderTasksByPosition(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.position - b.position);
}

/** Renumber a task list so `position` is contiguous starting at 0. */
function renumberTasks(tasks: Task[]): Task[] {
  return tasks.map((task, index) => ({ ...task, position: index }));
}

/** Remove `taskId` from a column task list and renumber the rest. */
export function removeTaskFromColumn(tasks: Task[], taskId: string): Task[] {
  return renumberTasks(
    orderTasksByPosition(tasks).filter((task) => task.id !== taskId),
  );
}

/**
 * Insert (or move) `task` into a column task list at `position` (0-based,
 * clamped to the list bounds) and renumber all positions. Any existing
 * occurrence of the task is removed first, which makes this safe for both
 * same-column reorders and cross-column moves.
 */
export function insertTaskIntoColumn(
  tasks: Task[],
  task: Task,
  columnId: string,
  position: number,
): Task[] {
  const withoutTask = removeTaskFromColumn(tasks, task.id);
  const nextIndex = clampIndex(position, withoutTask.length);
  withoutTask.splice(nextIndex, 0, { ...task, columnId });
  return renumberTasks(withoutTask);
}

/** Move `columnId` to `position` (0-based) in the board column list. */
export function reorderColumns(
  columns: Column[],
  columnId: string,
  position: number,
): Column[] {
  const ordered = [...columns].sort((a, b) => a.position - b.position);
  const moving = ordered.find((column) => column.id === columnId);
  if (!moving) return ordered;

  const withoutMoving = ordered.filter((column) => column.id !== columnId);
  const nextIndex = clampIndex(position, withoutMoving.length);
  withoutMoving.splice(nextIndex, 0, moving);

  return withoutMoving.map((column, index) => ({
    ...column,
    position: index,
  }));
}

/** Clamp a raw insertion index into the valid `[0, length]` range. */
function clampIndex(position: number, length: number): number {
  const clamped = Number.isFinite(position) ? Math.floor(position) : 0;
  return Math.max(0, Math.min(clamped, length));
}

/**
 * Given the tasks currently registered for one column as `{ index, top,
 * height }` entries, count how many sit above the pointer's Y coordinate.
 * This turns a drop on a column's empty area into the matching insertion
 * index (top, between tasks, or bottom) instead of always appending.
 */
export function countTasksAbovePointer(
  entries: readonly { index: number; top: number; height: number }[],
  pointerY: number,
): number {
  return [...entries]
    .sort((a, b) => a.index - b.index)
    .filter(({ top, height }) => top + height / 2 < pointerY).length;
}

/**
 * Collect the currently rendered task cards of `columnId` from the drag-drop
 * manager registry so the insertion index can be derived from the pointer
 * position. Used both by the board drop handler (final position on drop) and
 * by the live cross-column insertion placeholder, guaranteeing the preview and
 * the committed move always agree on the destination index.
 */
export function collectColumnTaskEntries(
  manager: DragDropManager,
  columnId: string,
): { index: number; top: number; height: number }[] {
  const entries: { index: number; top: number; height: number }[] = [];

  for (const droppable of manager.registry.droppables) {
    if (!isSortable(droppable)) continue;
    if (String(droppable.sortable.group ?? "") !== columnId) continue;

    const element = droppable.element;
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    entries.push({
      index: droppable.sortable.index,
      top: rect.top,
      height: rect.height,
    });
  }

  return entries;
}