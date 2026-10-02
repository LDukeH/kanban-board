import { getBoards } from "@/lib/api/board.api";
import { getBoardColumns } from "@/lib/api/column.api";
import { getColumnTasks } from "@/lib/api/task.api";
import type { Board, Column, Task } from "@/types/board";

/** One row of a "where the work sits" breakdown — a column on a board, or a board in a workspace. */
export interface SummaryBucket {
  id: string;
  label: string;
  total: number;
  completed: number;
}

export interface AssigneeSummary {
  email: string;
  total: number;
  completed: number;
}

export interface TaskSummary {
  total: number;
  completed: number;
  /** Has a due date earlier than `today` and is not completed. */
  overdue: number;
  /** Tasks with no assignee at all. */
  unassigned: number;
  /** Board scope only; dropped when summaries are merged across boards. */
  byColumn: SummaryBucket[];
  byAssignee: AssigneeSummary[];
}

/** Today as the backend's due_date format, so dates compare without timezone drift. */
export function todayISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Overdue means a due date has passed and the task is not finished. Both
 * fields are compared as "YYYY-MM-DD" strings, which sort correctly
 * lexicographically, and a completed task is never overdue.
 *
 * `today` is injectable so tests are not clock-dependent.
 */
export function isOverdue(task: Task, today: string = todayISO()): boolean {
  if (task.completed) return false;
  if (!task.dueDate) return false;
  return task.dueDate < today;
}

/**
 * Pure client-side roll-up of a set of tasks (Feature 5).
 *
 * There is no aggregate endpoint, so this derives every number from tasks the
 * client already has — never from a second server-side model. `columns` only
 * shapes the `byColumn` breakdown; totals ignore it, so a task in an
 * unrecognised column still counts towards `total`.
 */
export function computeTaskSummary(
  tasks: Task[],
  columns: Column[],
  today: string = todayISO(),
): TaskSummary {
  const columnTotals = new Map<string, { total: number; completed: number }>();
  const assigneeTotals = new Map<string, { total: number; completed: number }>();

  let completed = 0;
  let overdue = 0;
  let unassigned = 0;

  for (const task of tasks) {
    const isCompleted = task.completed;
    if (isCompleted) completed += 1;
    if (isOverdue(task, today)) overdue += 1;

    const bucket = columnTotals.get(task.columnId) ?? {
      total: 0,
      completed: 0,
    };
    bucket.total += 1;
    if (isCompleted) bucket.completed += 1;
    columnTotals.set(task.columnId, bucket);

    const assignees = task.assignees ?? [];
    if (assignees.length === 0) {
      unassigned += 1;
    } else {
      // A task shared by two people counts once for each of them: this is a
      // workload view, not a partition of the task list.
      for (const assignee of assignees) {
        const entry = assigneeTotals.get(assignee.email) ?? {
          total: 0,
          completed: 0,
        };
        entry.total += 1;
        if (isCompleted) entry.completed += 1;
        assigneeTotals.set(assignee.email, entry);
      }
    }
  }

  return {
    total: tasks.length,
    completed,
    overdue,
    unassigned,
    byColumn: columns.map((column) => ({
      id: column.id,
      label: column.name,
      total: columnTotals.get(column.id)?.total ?? 0,
      completed: columnTotals.get(column.id)?.completed ?? 0,
    })),
    byAssignee: [...assigneeTotals.entries()]
      .map(([email, entry]) => ({ email, ...entry }))
      .sort((a, b) => b.total - a.total || a.email.localeCompare(b.email)),
  };
}

/**
 * Folds per-board summaries into one workspace roll-up.
 *
 * `byColumn` is intentionally dropped: column names are board-scoped, so a
 * merged column list would claim distinctions that do not exist across boards.
 * Per-board rows carry that detail instead.
 */
export function mergeTaskSummaries(summaries: TaskSummary[]): TaskSummary {
  const assignees = new Map<string, { total: number; completed: number }>();

  const merged: TaskSummary = {
    total: 0,
    completed: 0,
    overdue: 0,
    unassigned: 0,
    byColumn: [],
    byAssignee: [],
  };

  for (const summary of summaries) {
    merged.total += summary.total;
    merged.completed += summary.completed;
    merged.overdue += summary.overdue;
    merged.unassigned += summary.unassigned;

    for (const entry of summary.byAssignee) {
      const current = assignees.get(entry.email) ?? {
        total: 0,
        completed: 0,
      };
      current.total += entry.total;
      current.completed += entry.completed;
      assignees.set(entry.email, current);
    }
  }

  merged.byAssignee = [...assignees.entries()]
    .map(([email, entry]) => ({ email, ...entry }))
    .sort((a, b) => b.total - a.total || a.email.localeCompare(b.email));

  return merged;
}

/** Loads one board's columns and every task on them. */
export async function collectBoardTasks(
  boardId: string,
): Promise<{ columns: Column[]; tasks: Task[] }> {
  const columns = await getBoardColumns(boardId);
  const taskLists = await Promise.all(
    columns.map((column) => getColumnTasks(column.id)),
  );
  return { columns, tasks: taskLists.flat() };
}

/**
 * Walks workspace -> boards -> columns -> tasks, the same cascade
 * `findBoardIdForTask` uses. Boards are visited one at a time (with each
 * board's columns fetched in parallel) so a large workspace does not open one
 * request per column all at once.
 */
export async function collectWorkspaceBoardTasks(
  workspaceId: string,
): Promise<{ board: Board; columns: Column[]; tasks: Task[] }[]> {
  const boards = await getBoards(workspaceId);
  const results: { board: Board; columns: Column[]; tasks: Task[] }[] = [];

  for (const board of boards) {
    const { columns, tasks } = await collectBoardTasks(board.id);
    results.push({ board, columns, tasks });
  }

  return results;
}
