import type { Label, Task } from "@/types/board";

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

export function isTaskFilterActive(filter: TaskFilter): boolean {
  return (
    filter.query.trim().length > 0 ||
    filter.hasNoAssignees ||
    filter.assigneeEmails.length > 0 ||
    filter.hasNoLabels ||
    filter.labelNames.length > 0
  );
}


export function taskFilterCount(filter: TaskFilter): number {
  let count = 0;
  if (filter.query.trim().length > 0) count += 1;
  if (filter.hasNoAssignees) count += 1;
  if (filter.hasNoLabels) count += 1;
  count += filter.assigneeEmails.length;
  count += filter.labelNames.length;
  return count;
}

export function clearTaskFilter(): TaskFilter {
  return emptyTaskFilter();
}

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
