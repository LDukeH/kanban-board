import { useEffect, useMemo, useRef, useState } from "react";
import { ListFilter, Search, X, Loader2, ArrowLeft } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LabelBadge } from "@/components/board/LabelBadge";
import { useBoard } from "@/hooks/useBoard";
import { useWorkspaceMembers } from "@/hooks/useWorkspaces";
import { cn } from "@/lib/utils";
import { emailInitial, avatarGradient } from "@/lib/memberDisplay";
import { TASK_PRIORITIES, type TaskPriority } from "@/types/board";
import {
  clearTaskFilter,
  COMPLETION_STATUSES,
  DUE_STATUSES,
  isTaskFilterActive,
  taskFilterCount,
  type TaskCompletionStatus,
  type TaskDueStatus,
  type TaskFilter,
} from "@/lib/taskFilter";

interface TaskFilterPopoverProps {
  filter: TaskFilter;
  onChange: (filter: TaskFilter) => void;
  boardId: string;
  workspaceId?: string;
}

function stateLabel(
  { empty, selected }: { empty: boolean; selected: string[] },
  { none, singular, plural, all }: { none: string; singular: string; plural: string; all: string },
): string {
  if (empty) return none;
  if (selected.length === 1) return `1 ${singular}`;
  if (selected.length > 1) return `${selected.length} ${plural}`;
  return all;
}

const ASSIGNEE_WORDS = { none: "Unassigned", singular: "assignee", plural: "assignees", all: "All assignees" };
const LABEL_WORDS = { none: "No labels", singular: "label", plural: "labels", all: "All labels" };

/** Visible text per option for the metadata filter rows. */
const PRIORITY_OPTION_LABEL: Record<TaskPriority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};
const DUE_OPTION_LABEL: Record<TaskDueStatus, string> = {
  overdue: "Overdue",
  scheduled: "Scheduled",
  unscheduled: "No due date",
};
const COMPLETION_OPTION_LABEL: Record<TaskCompletionStatus, string> = {
  completed: "Completed",
  active: "Active",
};

/**
 * Summarises a metadata selection for its row trigger.
 *
 * Unlike the assignee/label rows (which can only count), these groups have
 * short closed value sets, so naming the single selection is more useful than
 * "1 priority".
 */
function enumSummary<T>(
  selected: T[],
  { all, label, plural }: { all: string; label: (value: T) => string; plural: string },
): string {
  if (selected.length === 0) return all;
  if (selected.length === 1) return label(selected[0]);
  return `${selected.length} ${plural}`;
}

/** Toggles one value in a metadata group's selection list. */
function toggleEnumValue<T>(selected: T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((entry) => entry !== value)
    : [...selected, value];
}

/**
 * One metadata filter row: a trigger showing the current selection, expanding
 * into a multi-select of the group's closed value set. Mirrors the Assignee and
 * Label rows so the three metadata rows stay visually identical.
 */
function FilterSubMenu<T extends string>({
  title,
  summary,
  active,
  options,
  selected,
  labelFor,
  onToggle,
}: {
  title: string;
  summary: string;
  active: boolean;
  options: readonly T[];
  selected: T[];
  labelFor: (value: T) => string;
  onToggle: (value: T) => void;
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{title}</DropdownMenuLabel>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className={cn(active && "font-medium text-primary")}>
              {summary}
            </span>
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-56">
          <DropdownMenuLabel className="flex items-center gap-1.5">
            <ArrowLeft className="size-3.5 text-muted-foreground" />
            {title}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selected.includes(option)}
              onCheckedChange={() => onToggle(option)}
              closeOnClick={false}
            >
              <span className="text-sm">{labelFor(option)}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuGroup>
  );
}

/** Board-level filter: a top search bar plus Assignee/Label rows that expand into multi-selects, each row doubling as the live filter state. */
export function TaskFilterPopover({
  filter,
  onChange,
  boardId,
  workspaceId,
}: TaskFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  const { labels } = useBoard(boardId);
  const membersQuery = useWorkspaceMembers(workspaceId);

  const members = membersQuery.data ?? [];
  const isLoadingMembers =
    !!workspaceId && (membersQuery.isLoading || membersQuery.isFetching);
  const activeCount = taskFilterCount(filter);
  const filterActive = isTaskFilterActive(filter);

  const assigneeActive =
    filter.hasNoAssignees || filter.assigneeEmails.length > 0;
  const labelActive = filter.hasNoLabels || filter.labelNames.length > 0;

  const assigneeSummary = stateLabel(
    { empty: filter.hasNoAssignees, selected: filter.assigneeEmails },
    ASSIGNEE_WORDS,
  );
  const labelSummary = stateLabel(
    { empty: filter.hasNoLabels, selected: filter.labelNames },
    LABEL_WORDS,
  );

  const prioritySummary = enumSummary(filter.priorities, {
    all: "Any priority",
    label: (value) => PRIORITY_OPTION_LABEL[value],
    plural: "priorities",
  });
  const dueSummary = enumSummary(filter.dueStatuses, {
    all: "Any due date",
    label: (value) => DUE_OPTION_LABEL[value],
    plural: "due dates",
  });
  const completionSummary = enumSummary(filter.completion, {
    all: "Any status",
    label: (value) => COMPLETION_OPTION_LABEL[value],
    plural: "statuses",
  });

  const sortedLabels = useMemo(
    () => [...labels].sort((a, b) => a.name.localeCompare(b.name)),
    [labels],
  );

  // Trello-style search narrows the visible label/member options but never mutates existing selections.
  const query = filter.query.trim().toLowerCase();
  const isSearching = query.length > 0;
  const visibleLabels = useMemo(
    () =>
      isSearching
        ? sortedLabels.filter((l) => l.name.toLowerCase().includes(query))
        : sortedLabels,
    [sortedLabels, isSearching, query],
  );
  const visibleMembers = useMemo(
    () => {
      const all = membersQuery.data ?? [];
      return isSearching
        ? all.filter((m) => m.email.toLowerCase().includes(query))
        : all;
    },
    [membersQuery.data, isSearching, query],
  );

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Autofocus on open only, never stealing focus back while the user works the filter controls.
  useEffect(() => {
    if (open) {
      // Defer so the menu's own focus handling settles first.
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  function clearSearch() {
    onChange({ ...filter, query: "" });
    searchInputRef.current?.focus();
  }

  function update(patch: Partial<TaskFilter>) {
    onChange({ ...filter, ...patch });
  }

  function toggleAssignee(email: string) {
    const has = filter.assigneeEmails.includes(email);
    update({
      assigneeEmails: has
        ? filter.assigneeEmails.filter((e) => e !== email)
        : [...filter.assigneeEmails, email],
      hasNoAssignees: false,
    });
  }

  function toggleNoAssignees() {
    update({ hasNoAssignees: !filter.hasNoAssignees, assigneeEmails: [] });
  }

  function toggleLabel(name: string) {
    const has = filter.labelNames.includes(name);
    update({
      labelNames: has
        ? filter.labelNames.filter((n) => n !== name)
        : [...filter.labelNames, name],
      hasNoLabels: false,
    });
  }

  function toggleNoLabels() {
    update({ hasNoLabels: !filter.hasNoLabels, labelNames: [] });
  }

  function togglePriority(value: TaskPriority) {
    update({ priorities: toggleEnumValue(filter.priorities, value) });
  }

  function toggleDueStatus(value: TaskDueStatus) {
    update({ dueStatuses: toggleEnumValue(filter.dueStatuses, value) });
  }

  function toggleCompletion(value: TaskCompletionStatus) {
    update({ completion: toggleEnumValue(filter.completion, value) });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-muted",
            filterActive ? "text-primary" : "text-muted-foreground",
          )}
          title="Filter tasks"
        >
          <ListFilter className="size-4" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {activeCount}
            </span>
          )}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-72"
        style={{ maxHeight: "min(70vh, 480px)" }}
      >
        <div className="relative px-1 pb-1 pt-1.5">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            className="h-8 pl-8 pr-7"
            placeholder="Search title, assignee, label..."
            value={filter.query}
            onChange={(e) => onChange({ ...filter, query: e.target.value })}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
          />
          {filter.query.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onMouseDown={(e) => {
                // Prevent the input from losing focus before clearing.
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                clearSearch();
              }}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <DropdownMenuGroup>
          <DropdownMenuLabel>Assignee</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span
                  className={cn(assigneeActive && "font-medium text-primary")}
                >
                  {assigneeSummary}
                </span>
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <ArrowLeft className="size-3.5 text-muted-foreground" />
                Assignee
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filter.hasNoAssignees}
                onCheckedChange={toggleNoAssignees}
                closeOnClick={false}
              >
                <span className="text-sm">Unassigned</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {isLoadingMembers ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No members in this workspace yet.
                </p>
              ) : (
                members.map((member) => {
                  const checked = filter.assigneeEmails.includes(member.email);
                  return (
                    <DropdownMenuCheckboxItem
                      key={member.userId}
                      checked={checked}
                      onCheckedChange={() => toggleAssignee(member.email)}
                      closeOnClick={false}
                      className="gap-2"
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white",
                          avatarGradient(member.userId || member.email),
                        )}
                      >
                        {emailInitial(member.email)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {member.email}
                      </span>
                    </DropdownMenuCheckboxItem>
                  );
                })
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuGroup>
          <DropdownMenuLabel>Label</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className={cn(labelActive && "font-medium text-primary")}>
                  {labelSummary}
                </span>
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <ArrowLeft className="size-3.5 text-muted-foreground" />
                Label
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filter.hasNoLabels}
                onCheckedChange={toggleNoLabels}
                closeOnClick={false}
              >
                <span className="text-sm">No labels</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {sortedLabels.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No labels on this board yet.
                </p>
              ) : (
                sortedLabels.map((label) => (
                  <DropdownMenuCheckboxItem
                    key={label.id}
                    checked={filter.labelNames.includes(label.name)}
                    onCheckedChange={() => toggleLabel(label.name)}
                    closeOnClick={false}
                    className="gap-2"
                  >
                    <LabelBadge label={label} className="flex-1 text-[11px]" />
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <FilterSubMenu
          title="Priority"
          summary={prioritySummary}
          active={filter.priorities.length > 0}
          options={TASK_PRIORITIES}
          selected={filter.priorities}
          labelFor={(value) => PRIORITY_OPTION_LABEL[value]}
          onToggle={togglePriority}
        />

        <FilterSubMenu
          title="Due date"
          summary={dueSummary}
          active={filter.dueStatuses.length > 0}
          options={DUE_STATUSES}
          selected={filter.dueStatuses}
          labelFor={(value) => DUE_OPTION_LABEL[value]}
          onToggle={toggleDueStatus}
        />

        <FilterSubMenu
          title="Status"
          summary={completionSummary}
          active={filter.completion.length > 0}
          options={COMPLETION_STATUSES}
          selected={filter.completion}
          labelFor={(value) => COMPLETION_OPTION_LABEL[value]}
          onToggle={toggleCompletion}
        />

        {/* Trello-style inline results: while the main keyword query is
            non-empty, matching members/labels are shown directly in the main
            popover body. The query only controls visibility — existing
            selections are never mutated. */}
        {isSearching && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Members</DropdownMenuLabel>
              {isLoadingMembers ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : visibleMembers.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No matching members.
                </p>
              ) : (
                visibleMembers.map((member) => {
                  const checked = filter.assigneeEmails.includes(member.email);
                  return (
                    <DropdownMenuCheckboxItem
                      key={member.userId}
                      checked={checked}
                      onCheckedChange={() => toggleAssignee(member.email)}
                      closeOnClick={false}
                      className="gap-2"
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white",
                          avatarGradient(member.userId || member.email),
                        )}
                      >
                        {emailInitial(member.email)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {member.email}
                      </span>
                    </DropdownMenuCheckboxItem>
                  );
                })
              )}
            </DropdownMenuGroup>

            <DropdownMenuGroup>
              <DropdownMenuLabel>Labels</DropdownMenuLabel>
              {visibleLabels.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No matching labels.
                </p>
              ) : (
                visibleLabels.map((label) => (
                  <DropdownMenuCheckboxItem
                    key={label.id}
                    checked={filter.labelNames.includes(label.name)}
                    onCheckedChange={() => toggleLabel(label.name)}
                    closeOnClick={false}
                    className="gap-2"
                  >
                    <LabelBadge label={label} className="flex-1 text-[11px]" />
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!filterActive}
          onClick={() => onChange(clearTaskFilter())}
        >
          <X className="size-3.5" />
          Clear filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
