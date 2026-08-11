import type { Label, Task } from "@/types/board";

/**
 * Client-side filter for tasks on a board (filter popover).
 *
 * Semantics (all FE-only, applied to each column's already-cached tasks):
 * - `query` matches a task if the text appears in its title, any assignee
 *   email, or any label name (OR across those fields).
 * - The assignee group passes if the task has zero assignees (`hasNoAssignees`)
 *   OR has ANY of the selected `assigneeEmails`.
 * - The label group passes if the task has zero labels (`hasNoLabels`) OR has
 *   ANY of the selected `labelNames`.
 * - The query, assignee group, and label group combine with AND; empty/unset
 *   groups always pass.
 *
 * We key assignees by their `email` and labels by their `name` (rather than by
 * IDs) so the filter can be serialized into a short, human-readable URL that
 * survives refresh without needing to resolve names back to IDs.
 */
export interface TaskFilter {
  query: string;
  hasNoAssignees: boolean;
  assigneeEmails: string[];
  hasNoLabels: boolean;
  labelNames: string[];
}

export function emptyTaskFilter(): TaskFilter {
  return {
    query: "",
    hasNoAssignees: false,
    assigneeEmails: [],
    hasNoLabels: false,
    labelNames: [],
  };
}

/** True when at least one criterion is set (used to skip filtering work). */
export function isTaskFilterActive(filter: TaskFilter): boolean {
  return (
    filter.query.trim().length > 0 ||
    filter.hasNoAssignees ||
    filter.assigneeEmails.length > 0 ||
    filter.hasNoLabels ||
    filter.labelNames.length > 0
  );
}

/** Number of active criterion groups — used for the trigger badge count. */
export function taskFilterCount(filter: TaskFilter): number {
  let count = 0;
  if (filter.query.trim().length > 0) count += 1;
  if (filter.hasNoAssignees) count += 1;
  if (filter.assigneeEmails.length > 0) count += 1;
  if (filter.hasNoLabels) count += 1;
  if (filter.labelNames.length > 0) count += 1;
  return count;
}

export function clearTaskFilter(): TaskFilter {
  return emptyTaskFilter();
}

/** Whether a single task satisfies the filter. */
export function matchesTaskFilter(task: Task, filter: TaskFilter): boolean {
  const q = filter.query.trim().toLowerCase();

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

  // Assignee group: matches only if the user's *selection* is satisfied.
  // - "0 assigned" checked → task must have zero assignees.
  // - specific assignees picked → task must have at least one by email.
  if (filter.hasNoAssignees || filter.assigneeEmails.length > 0) {
    const passesNoAssignees =
      filter.hasNoAssignees && (task.assignees ?? []).length === 0;
    const passesSelected = filter.assigneeEmails.some((email) =>
      (task.assignees ?? []).some((a) => a.email === email),
    );
    if (!passesNoAssignees && !passesSelected) return false;
  }

  // Label group: matches only if the user's *selection* is satisfied.
  // - "0 labels" checked → task must have zero labels.
  // - specific labels picked → task must have at least one by name.
  if (filter.hasNoLabels || filter.labelNames.length > 0) {
    const passesNoLabels =
      filter.hasNoLabels && (task.labels ?? []).length === 0;
    const passesSelected = filter.labelNames.some((name) =>
      (task.labels ?? []).some((l) => l.name === name),
    );
    if (!passesNoLabels && !passesSelected) return false;
  }

  return true;
}

/**
 * The `limit` most frequently used labels across the given tasks (for the
 * filter popover's quick-select section). Ties are broken by label name.
 */
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

/** URL param name for the text query. */
const QUERY_PARAM = "q";
/** URL param name for the "0 assigned" toggle. */
const NO_ASSIGNEES_PARAM = "no_assignees";
/** URL param name for the selected assignee ids (comma-separated). */
const ASSIGNEES_PARAM = "assignees";
/** URL param name for the "0 labels" toggle. */
const NO_LABELS_PARAM = "no_labels";
/** URL param name for the selected label ids (comma-separated). */
const LABELS_PARAM = "labels";

/** Serialize a TaskFilter into URL search params (for persistence). */
export function filterToSearchParams(filter: TaskFilter): Record<string, string> {
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
  return params;
}

/** Parse URL search params back into a TaskFilter. */
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
  };
}

const STORAGE_KEY_PREFIX = "kanbanBoard.taskFilter.";

/**
 * Remember a board's filter so it can be restored when the user returns to the
 * board via a clean URL (e.g. sidebar navigation strips search params). Each
 * board is stored under its own key so one board's filter never leaks onto
 * another. Storage failures are ignored (filtering still works in-session).
 */
export function saveBoardTaskFilter(boardId: string, filter: TaskFilter): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + boardId, JSON.stringify(filter));
  } catch {
    // Ignore (private mode / quota) — the in-memory filter still works.
  }
}

/** Load a board's previously saved filter, or an empty one if none exists. */
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


