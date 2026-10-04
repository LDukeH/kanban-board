import { isOverdue, todayISO } from "@/lib/summary";
import type { Label, Task, TaskPriority } from "@/types/board";
import { TASK_PRIORITIES } from "@/types/board";

/** When a task's due date falls, derived on the fly rather than stored. */
export type TaskDueStatus = "overdue" | "scheduled" | "unscheduled";

export type TaskCompletionStatus = "completed" | "active";

export interface TaskFilter {
  query: string;
  hasNoAssignees: boolean;
  assigneeEmails: string[];
  hasNoLabels: boolean;
  labelNames: string[];
  /** Empty means "any priority". */
  priorities: TaskPriority[];
  /** Empty means "any due-date state". */
  dueStatuses: TaskDueStatus[];
  /** Empty means "either state". */
  completion: TaskCompletionStatus[];
}

export function emptyTaskFilter(): TaskFilter {
  return {
    query: "",
    hasNoAssignees: false,
    assigneeEmails: [],
    hasNoLabels: false,
    labelNames: [],
    priorities: [],
    dueStatuses: [],
    completion: [],
  };
}

/** The due-date bucket a task falls into for the given day. */
export function taskDueStatus(
  task: Task,
  today: string = todayISO(),
): TaskDueStatus {
  if (!task.dueDate) return "unscheduled";
  if (isOverdue(task, today)) return "overdue";
  return "scheduled";
}

export function taskCompletionStatus(task: Task): TaskCompletionStatus {
  return task.completed ? "completed" : "active";
}

export function isTaskFilterActive(filter: TaskFilter): boolean {
  return (
    filter.query.trim().length > 0 ||
    filter.hasNoAssignees ||
    filter.assigneeEmails.length > 0 ||
    filter.hasNoLabels ||
    filter.labelNames.length > 0 ||
    filter.priorities.length > 0 ||
    filter.dueStatuses.length > 0 ||
    filter.completion.length > 0
  );
}


export function taskFilterCount(filter: TaskFilter): number {
  let count = 0;
  if (filter.query.trim().length > 0) count += 1;
  if (filter.hasNoAssignees) count += 1;
  if (filter.hasNoLabels) count += 1;
  count += filter.assigneeEmails.length;
  count += filter.labelNames.length;
  count += filter.priorities.length;
  count += filter.dueStatuses.length;
  count += filter.completion.length;
  return count;
}

export function clearTaskFilter(): TaskFilter {
  return emptyTaskFilter();
}

export function matchesTaskFilter(task: Task, filter: TaskFilter): boolean {
  const q = filter.query.trim().toLowerCase();
  const today = todayISO();

  // Search bar: OR across title, any assignee email, any label name.
  if (q.length > 0) {
    const inTitle = task.title.toLowerCase().includes(q);
    const inAssignee = (task.assignees ?? []).some((a) =>
      a.email.toLowerCase().includes(q),
    );
    const inLabel = (task.labels ?? []).some((l) =>
      l.name.toLowerCase().includes(q),
    );
    if (!inTitle && !inAssignee && !inLabel) return false;
  }

  // A selection only matches if satisfied: "0 assigned" needs zero assignees, picked emails need at least one.
  if (filter.hasNoAssignees || filter.assigneeEmails.length > 0) {
    const passesNoAssignees =
      filter.hasNoAssignees && (task.assignees ?? []).length === 0;
    const passesSelected = filter.assigneeEmails.some((email) =>
      (task.assignees ?? []).some((a) => a.email === email),
    );
    if (!passesNoAssignees && !passesSelected) return false;
  }

  // Same OR-within-group rule as assignees: "0 labels" needs zero labels, picked names need at least one.
  if (filter.hasNoLabels || filter.labelNames.length > 0) {
    const passesNoLabels =
      filter.hasNoLabels && (task.labels ?? []).length === 0;
    const passesSelected = filter.labelNames.some((name) =>
      (task.labels ?? []).some((l) => l.name === name),
    );
    if (!passesNoLabels && !passesSelected) return false;
  }

  // Same OR-within-group rule for the metadata filters: a selection narrows the list, an empty selection matches everything.
  if (filter.priorities.length > 0) {
    if (!filter.priorities.includes(task.priority)) return false;
  }

  if (filter.dueStatuses.length > 0) {
    if (!filter.dueStatuses.includes(taskDueStatus(task, today))) return false;
  }

  if (filter.completion.length > 0) {
    if (!filter.completion.includes(taskCompletionStatus(task))) return false;
  }

  return true;
}

export function topLabelsByUsage(tasks: Task[], limit: number): Label[] {
  const counts = new Map<string, number>();
  const byId = new Map<string, Label>();

  for (const task of tasks) {
    for (const label of task.labels ?? []) {
      counts.set(label.id, (counts.get(label.id) ?? 0) + 1);
      if (!byId.has(label.id)) byId.set(label.id, label);
    }
  }

  return Array.from(byId.values())
    .sort(
      (a, b) =>
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

const QUERY_PARAM = "q";
const NO_ASSIGNEES_PARAM = "no_assignees";
const ASSIGNEES_PARAM = "assignees";
const NO_LABELS_PARAM = "no_labels";
const LABELS_PARAM = "labels";
const PRIORITIES_PARAM = "priority";
const DUE_PARAM = "due";
const COMPLETION_PARAM = "completion";

/** Every due-date state, in display order — the single source for URL parsing and the filter UI. */
export const DUE_STATUSES: readonly TaskDueStatus[] = [
  "overdue",
  "scheduled",
  "unscheduled",
];

/** Every completion state, in display order. */
export const COMPLETION_STATUSES: readonly TaskCompletionStatus[] = [
  "completed",
  "active",
];

export function filterToSearchParams(
  filter: TaskFilter,
): Record<string, string> {
  const params: Record<string, string> = {};
  const query = filter.query.trim();
  if (query) params[QUERY_PARAM] = query;
  if (filter.hasNoAssignees) params[NO_ASSIGNEES_PARAM] = "1";
  if (filter.assigneeEmails.length > 0) {
    params[ASSIGNEES_PARAM] = filter.assigneeEmails
      .map(encodeURIComponent)
      .join(",");
  }
  if (filter.hasNoLabels) params[NO_LABELS_PARAM] = "1";
  if (filter.labelNames.length > 0) {
    params[LABELS_PARAM] = filter.labelNames.map(encodeURIComponent).join(",");
  }
  // These three hold fixed enum tokens, so they need no per-item encoding.
  if (filter.priorities.length > 0) {
    params[PRIORITIES_PARAM] = filter.priorities.join(",");
  }
  if (filter.dueStatuses.length > 0) {
    params[DUE_PARAM] = filter.dueStatuses.join(",");
  }
  if (filter.completion.length > 0) {
    params[COMPLETION_PARAM] = filter.completion.join(",");
  }
  return params;
}

export function filterFromSearchParams(params: URLSearchParams): TaskFilter {
  return {
    query: params.get(QUERY_PARAM) ?? "",
    hasNoAssignees: params.get(NO_ASSIGNEES_PARAM) === "1",
    assigneeEmails: (params.get(ASSIGNEES_PARAM) ?? "")
      .split(",")
      .map(decodeURIComponent)
      .map((s) => s.trim())
      .filter(Boolean),
    hasNoLabels: params.get(NO_LABELS_PARAM) === "1",
    labelNames: (params.get(LABELS_PARAM) ?? "")
      .split(",")
      .map(decodeURIComponent)
      .map((s) => s.trim())
      .filter(Boolean),
    // Unknown tokens from a hand-edited URL are dropped so the filter can only ever hold values the rest of the code understands.
    priorities: (params.get(PRIORITIES_PARAM) ?? "")
      .split(",")
      .filter((value): value is TaskPriority =>
        (TASK_PRIORITIES as readonly string[]).includes(value),
      ),
    dueStatuses: (params.get(DUE_PARAM) ?? "")
      .split(",")
      .filter((value): value is TaskDueStatus =>
        (DUE_STATUSES as readonly string[]).includes(value),
      ),
    completion: (params.get(COMPLETION_PARAM) ?? "")
      .split(",")
      .filter((value): value is TaskCompletionStatus =>
        (COMPLETION_STATUSES as readonly string[]).includes(value),
      ),
  };
}

const STORAGE_KEY_PREFIX = "kanbanBoard.taskFilter.";

export function saveBoardTaskFilter(boardId: string, filter: TaskFilter): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + boardId, JSON.stringify(filter));
  } catch {
    // Ignore (private mode / quota) — the in-memory filter still works.
  }
}

export function loadBoardTaskFilter(boardId: string): TaskFilter {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + boardId);
    if (!raw) return emptyTaskFilter();
    const parsed = JSON.parse(raw) as Partial<TaskFilter>;
    // Merge over the empty filter so missing fields always have valid values.
    return { ...emptyTaskFilter(), ...parsed };
  } catch {
    return emptyTaskFilter();
  }
}
