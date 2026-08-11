import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListFilter, Search, X, Loader2 } from "lucide-react";

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
import {
  clearTaskFilter,
  isTaskFilterActive,
  taskFilterCount,
  topLabelsByUsage,
  type TaskFilter,
} from "@/lib/taskFilter";
import type { Task } from "@/types/board";

const QUICK_LABEL_LIMIT = 4;

interface TaskFilterPopoverProps {
  filter: TaskFilter;
  onChange: (filter: TaskFilter) => void;
  boardId: string;
  workspaceId?: string;
}

/**
 * Board-level task filter, rendered as a single popover triggered by a filter
 * icon. Contains a top search bar (title / assignee email / label name) plus
 * Assignees and Labels sections, all inside a vertically scrollable panel.
 * The nested "pick assignees" / "all labels" menus are submenus.
 */
export function TaskFilterPopover({
  filter,
  onChange,
  boardId,
  workspaceId,
}: TaskFilterPopoverProps) {
  const [open, setOpen] = useState(false);

  const { labels } = useBoard(boardId);
  const membersQuery = useWorkspaceMembers(workspaceId);
  const queryClient = useQueryClient();

  // Gather every cached column task for this board to compute quick-label usage.
  const boardTasks = useMemo(() => {
    const tasks: Task[] = [];
    queryClient
      .getQueryCache()
      .findAll({ queryKey: ["boards", boardId, "columns"] })
      .filter(
        (query) => query.queryKey.length === 5 && query.queryKey[4] === "tasks",
      )
      .forEach((query) => {
        const data = queryClient.getQueryData<Task[]>(query.queryKey);
        if (data) tasks.push(...data);
      });
    return tasks;
  }, [queryClient, boardId]);

  const quickLabels = useMemo(
    () => topLabelsByUsage(boardTasks, QUICK_LABEL_LIMIT),
    [boardTasks],
  );

  const members = membersQuery.data ?? [];
  const isLoadingMembers =
    !!workspaceId && (membersQuery.isLoading || membersQuery.isFetching);
  const activeCount = taskFilterCount(filter);
  const filterActive = isTaskFilterActive(filter);

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
        {/* Search bar */}
        <div className="relative px-1 pb-1 pt-1.5">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder="Search title, assignee, label..."
            value={filter.query}
            onChange={(e) => onChange({ ...filter, query: e.target.value })}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
          />
        </div>

        {/* Assignees */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Assignees</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={filter.hasNoAssignees}
            onCheckedChange={toggleNoAssignees}
            closeOnClick={false}
          >
            <span className="text-sm">0 assigned</span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>Pick assignees…</span>
                {filter.assigneeEmails.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
                    {filter.assigneeEmails.length}
                  </span>
                )}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
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

        {/* Labels */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Labels</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={filter.hasNoLabels}
            onCheckedChange={toggleNoLabels}
            closeOnClick={false}
          >
            <span className="text-sm">0 labels</span>
          </DropdownMenuCheckboxItem>
          {quickLabels.map((label) => (
            <DropdownMenuCheckboxItem
              key={label.id}
              checked={filter.labelNames.includes(label.name)}
              onCheckedChange={() => toggleLabel(label.name)}
              closeOnClick={false}
              className="gap-2"
            >
              <LabelBadge label={label} className="flex-1 text-[11px]" />
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span>All labels…</span>
                {filter.labelNames.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
                    {filter.labelNames.length}
                  </span>
                )}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {labels.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No labels on this board yet.
                </p>
              ) : (
                labels.map((label) => (
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

        {filterActive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(clearTaskFilter())}>
              <X className="size-3.5" />
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
