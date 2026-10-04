import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ListFilter, Search, X, Loader2, ArrowLeft, Check } from "lucide-react";

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
  /** Board-wide tasks matching the current filter, and the board total. */
  matchedCount: number;
  totalCount: number;
  /** True while the board's task queries are still resolving. */
  isLoadingCount: boolean;
}

/** Section headings are deliberately NOT styled like menu rows: no hover, no chevron, no border. */
const HEADING_CLASS =
  "px-1.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/80";

/** Controls nest one indent step in from their heading. */
const CONTROL_INDENT = "px-1.5 pl-4";

/** Summarises a selection as "Lee" / "Lee +2". */
function namedSelection(
  values: string[],
  nameFor: (value: string) => string,
): string {
  if (values.length === 0) return "All";
  const [first, ...rest] = values;
  const name = nameFor(first);
  return rest.length === 0 ? name : `${name} +${rest.length}`;
}

/** Workspace members are only ever available as emails, so the local part stands in for a name. */
function assigneeName(email: string): string {
  const local = email.split("@")[0] ?? email;
  if (!local) return email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

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

/** Toggles one value in a metadata group's selection list. */
function toggleEnumValue<T>(selected: T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((entry) => entry !== value)
    : [...selected, value];
}

/** One selectable chip. Stays a DropdownMenuCheckboxItem so Base UI's arrow-key navigation still reaches it. */
function FilterChip({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      onCheckedChange={onToggle}
      closeOnClick={false}
      className={cn(
        "w-auto justify-start gap-1 rounded-full border py-1 pl-2 pr-2 text-xs",
        "[&>[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden",
        checked
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground focus:text-foreground",
      )}
    >
      {checked && <Check className="size-3 shrink-0" aria-hidden />}
      <span className="truncate">{label}</span>
    </DropdownMenuCheckboxItem>
  );
}

/** A fixed-option filter rendered as a horizontal row of inline chips, so the common values are one click away instead of behind a submenu. */
function FilterChips<T extends string>({
  options,
  selected,
  labelFor,
  onToggle,
  onClear,
}: {
  options: readonly T[];
  selected: T[];
  labelFor: (value: T) => string;
  onToggle: (value: T) => void;
  onClear: () => void;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", CONTROL_INDENT)}>
      <FilterChip
        checked={selected.length === 0}
        label="Any"
        onToggle={onClear}
      />
      {options.map((option) => (
        <FilterChip
          key={option}
          checked={selected.includes(option)}
          label={labelFor(option)}
          onToggle={() => onToggle(option)}
        />
      ))}
    </div>
  );
}

/** The Assignee/Label control: one row showing the current selection, indented under its heading, plus a muted hint of how many options the submenu holds so it can be judged before opening. */
function SubmenuFilterRow({
  summary,
  active,
  hint,
  children,
}: {
  summary: string;
  active: boolean;
  hint: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={cn(CONTROL_INDENT, "gap-2 py-1.5")}>
        {active && <Check className="size-3.5 shrink-0 text-primary" aria-hidden />}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            active && "font-medium text-primary",
          )}
        >
          {summary}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{hint}</span>
      </DropdownMenuSubTrigger>
      {children}
    </DropdownMenuSub>
  );
}

/** Board-level filter: a top search bar plus Assignee/Label rows that expand into multi-selects, each row doubling as the live filter state. */
export function TaskFilterPopover({
  filter,
  onChange,
  boardId,
  workspaceId,
  matchedCount,
  totalCount,
  isLoadingCount,
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

  const assigneeSummary = filter.hasNoAssignees
    ? "Unassigned"
    : namedSelection(filter.assigneeEmails, assigneeName);
  const labelSummary = filter.hasNoLabels
    ? "No labels"
    : namedSelection(filter.labelNames, (name) => name);

  const sortedLabels = useMemo(
    () => [...labels].sort((a, b) => a.name.localeCompare(b.name)),
    [labels],
  );

  // How many choices each submenu actually holds, so the row can advertise its contents without being opened.
  const assigneeHint = isLoadingMembers
    ? "Loading…"
    : `${members.length} ${members.length === 1 ? "member" : "members"}`;
  const labelHint = `${sortedLabels.length} ${sortedLabels.length === 1 ? "label" : "labels"}`;

  // Trello-style search narrows the visible label/member options but never mutates existing selections.
  const rawQuery = filter.query.trim();
  const query = rawQuery.toLowerCase();
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

  // "Any" on a chip row clears that group.
  function clearPriorities() {
    update({ priorities: [] });
  }

  function clearDueStatuses() {
    update({ dueStatuses: [] });
  }

  function clearCompletion() {
    update({ completion: [] });
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
        className="w-80"
        style={{ maxHeight: "min(70vh, 480px)" }}
      >
        <div className="px-1 pb-1 pt-1.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              className="h-8 pl-8 pr-7"
              placeholder="Filter tasks…"
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

          {/* The search does two jobs, so say so rather than leaving the placeholder to imply it. */}
          <p className="mt-1.5 px-1 text-[11px] leading-snug text-muted-foreground">
            Filters tasks by title, assignee or label, and narrows the member
            and label choices below.
          </p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className={HEADING_CLASS}>Assignee</DropdownMenuLabel>
          <SubmenuFilterRow
            summary={assigneeSummary}
            active={assigneeActive}
            hint={assigneeHint}
          >
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
          </SubmenuFilterRow>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className={HEADING_CLASS}>Label</DropdownMenuLabel>
          <SubmenuFilterRow
            summary={labelSummary}
            active={labelActive}
            hint={labelHint}
          >
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
          </SubmenuFilterRow>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className={HEADING_CLASS}>Priority</DropdownMenuLabel>
          <FilterChips
            options={TASK_PRIORITIES}
            selected={filter.priorities}
            labelFor={(value) => PRIORITY_OPTION_LABEL[value]}
            onToggle={togglePriority}
            onClear={clearPriorities}
          />
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className={HEADING_CLASS}>Due date</DropdownMenuLabel>
          <FilterChips
            options={DUE_STATUSES}
            selected={filter.dueStatuses}
            labelFor={(value) => DUE_OPTION_LABEL[value]}
            onToggle={toggleDueStatus}
            onClear={clearDueStatuses}
          />
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className={HEADING_CLASS}>Status</DropdownMenuLabel>
          <FilterChips
            options={COMPLETION_STATUSES}
            selected={filter.completion}
            labelFor={(value) => COMPLETION_OPTION_LABEL[value]}
            onToggle={toggleCompletion}
            onClear={clearCompletion}
          />
        </DropdownMenuGroup>

        {/* Trello-style inline results: while the main keyword query is non-empty, matching members/labels are shown directly in the main popover body. */}
        {isSearching && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className={HEADING_CLASS}>
                {`Members matching “${rawQuery}”`}
              </DropdownMenuLabel>
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
              <DropdownMenuLabel className={HEADING_CLASS}>
                {`Labels matching “${rawQuery}”`}
              </DropdownMenuLabel>
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

        {/* Result count from the same matchesTaskFilter the columns use, announced politely. */}
        <p
          aria-live="polite"
          className="px-2 py-1.5 text-xs text-muted-foreground"
        >
          {isLoadingCount ? (
            "Counting tasks…"
          ) : (
            <>
              <span className="font-semibold tabular-nums text-foreground">
                {matchedCount}
              </span>
              {" of "}
              <span className="tabular-nums">{totalCount}</span>
              {" tasks"}
            </>
          )}
        </p>

        <DropdownMenuItem
          disabled={!filterActive}
          onClick={() => onChange(clearTaskFilter())}
          className={cn(
            "gap-2",
            // Active state is carried by weight and background, not colour alone, and never destructive — clearing is not a dangerous action.
            filterActive && "bg-accent font-medium text-foreground",
          )}
        >
          <X className="size-3.5" />
          Clear filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
