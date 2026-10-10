import type { Task } from "@/types/board";

/** Next completion state for a toggle action. */
export function nextCompletionState(completed: boolean): boolean {
  return !completed;
}

/** Pure list update backing the optimistic toggle (tested without React). */
export function applyTaskCompletion(
  tasks: Task[],
  taskId: string,
  completed: boolean,
): Task[] {
  return tasks.map((task) =>
    task.id === taskId ? { ...task, completed } : task,
  );
}
