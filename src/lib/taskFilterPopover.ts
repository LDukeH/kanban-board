import type { Label, TaskPriority } from "@/types/board";
import type {
  TaskCompletionStatus,
  TaskDueStatus,
  TaskFilter,
} from "@/lib/taskFilter";
import type { WorkspaceMember } from "@/types/workspace";

/**
 * Pure state for `TaskFilterPopover` (no React, no queries).
 * Moved verbatim from the popover so the presentation layer can stay thin;
 * URL format and OR/AND semantics still live in `src/lib/taskFilter.ts`.
 */

/** Summarises a selection as "Lee" / "Lee +2". */
export function namedSelection(
  values: string[],
  nameFor: (value: string) => string,
): string {
  if (values.length === 0) return "All";
  const [first, ...rest] = values;
  const name = nameFor(first);
  return rest.length === 0 ? name : `${name} +${rest.length}`;
}

/** Workspace members are only ever available as emails, so the local part stands in for a name. */
export function assigneeName(email: string): string {
  const local = email.split("@")[0] ?? email;
  if (!local) return email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Toggles one value in a metadata group's selection list. */
export function toggleEnumValue<T>(selected: T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((entry) => entry !== value)
    : [...selected, value];
}

export function updateTaskFilter(
  filter: TaskFilter,
  patch: Partial<TaskFilter>,
): TaskFilter {
  return { ...filter, ...patch };
}

export function toggleFilterAssignee(filter: TaskFilter, email: string): TaskFilter {
  const has = filter.assigneeEmails.includes(email);
  return updateTaskFilter(filter, {
    assigneeEmails: has
      ? filter.assigneeEmails.filter((e) => e !== email)
      : [...filter.assigneeEmails, email],
    hasNoAssignees: false,
  });
}

export function toggleNoAssignees(filter: TaskFilter): TaskFilter {
  return updateTaskFilter(filter, {
    hasNoAssignees: !filter.hasNoAssignees,
    assigneeEmails: [],
  });
}

export function toggleFilterLabel(filter: TaskFilter, name: string): TaskFilter {
  const has = filter.labelNames.includes(name);
  return updateTaskFilter(filter, {
    labelNames: has
      ? filter.labelNames.filter((n) => n !== name)
      : [...filter.labelNames, name],
    hasNoLabels: false,
  });
}

export function toggleNoLabels(filter: TaskFilter): TaskFilter {
  return updateTaskFilter(filter, {
    hasNoLabels: !filter.hasNoLabels,
    labelNames: [],
  });
}

export function toggleFilterPriority(filter: TaskFilter, value: TaskPriority): TaskFilter {
  return updateTaskFilter(filter, { priorities: toggleEnumValue(filter.priorities, value) });
}

export function toggleFilterDueStatus(filter: TaskFilter, value: TaskDueStatus): TaskFilter {
  return updateTaskFilter(filter, { dueStatuses: toggleEnumValue(filter.dueStatuses, value) });
}

export function toggleFilterCompletion(
  filter: TaskFilter,
  value: TaskCompletionStatus,
): TaskFilter {
  return updateTaskFilter(filter, { completion: toggleEnumValue(filter.completion, value) });
}

export function isAssigneeFilterActive(filter: TaskFilter): boolean {
  return filter.hasNoAssignees || filter.assigneeEmails.length > 0;
}

export function isLabelFilterActive(filter: TaskFilter): boolean {
  return filter.hasNoLabels || filter.labelNames.length > 0;
}

export function describeAssigneeSelection(filter: TaskFilter): string {
  if (filter.hasNoAssignees) return "Unassigned";
  return namedSelection(filter.assigneeEmails, assigneeName);
}

export function describeLabelSelection(filter: TaskFilter): string {
  if (filter.hasNoLabels) return "No labels";
  return namedSelection(filter.labelNames, (name) => name);
}

export function sortLabelsByName(labels: Label[]): Label[] {
  return [...labels].sort((a, b) => a.name.localeCompare(b.name));
}

/** Trello-style search narrows the visible options but never mutates existing selections. */
export function normalizeFilterQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchLabelsByQuery(labels: Label[], query: string): Label[] {
  const normalized = normalizeFilterQuery(query);
  if (normalized.length === 0) return labels;
  return labels.filter((l) => l.name.toLowerCase().includes(normalized));
}

export function matchMembersByQuery(
  members: WorkspaceMember[],
  query: string,
): WorkspaceMember[] {
  const normalized = normalizeFilterQuery(query);
  if (normalized.length === 0) return members;
  return members.filter((m) => m.email.toLowerCase().includes(normalized));
}

export function filterOptionHint(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}
