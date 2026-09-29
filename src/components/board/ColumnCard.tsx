import { Fragment, useState } from "react";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import type { Column } from "@/types/board";
import { useSortable } from "@dnd-kit/react/sortable";
import { closestCenter } from "@dnd-kit/collision";
import { EditColumnDialog } from "@/components/dialog/EditColumnDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { CreateTaskDialog } from "@/components/dialog/CreateTaskDialog";
import { TaskCard } from "@/components/board/TaskCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoard } from "@/hooks/useBoard";
import { describeLoadError } from "@/lib/httpStatus";
import { useColumnTasks } from "@/hooks/useColumnTasks";
import { useDragDropManager, useDroppable } from "@dnd-kit/react";
import { useComputed } from "@dnd-kit/react/hooks";
import {
  collectColumnTaskEntries,
  countTasksAbovePointer,
} from "@/lib/dragDrop";
import {
  isTaskFilterActive,
  matchesTaskFilter,
  type TaskFilter,
} from "@/lib/taskFilter";

/** Empty card-sized slot that pushes a column's tasks apart while a foreign task is dragged over them. */
function TaskDropPlaceholder() {
  return (
    <div
      aria-hidden
      className="flex min-h-10 items-center justify-center rounded-lg border-2 border-dashed border-primary/40 bg-primary/5"
    >
      <span className="h-0.5 w-6 rounded-full bg-primary/40" />
    </div>
  );
}

interface ColumnCardProps {
  column: Column;
  className?: string;
  index: number;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreateTask?: boolean;
  canEditTask?: boolean;
  canDeleteTask?: boolean;
  /** Active board-level task filter; when set only matching tasks render. */
  filter?: TaskFilter;
}

export function ColumnCard({
  column,
  className,
  index,
  canEdit = false,
  canDelete = false,
  canCreateTask = false,
  canEditTask = false,
  canDeleteTask = false,
  filter,
}: ColumnCardProps) {
  const { deleteColumn, isDeletingColumn } = useBoard(column.boardId);
  const {
    tasks,
    isLoadingTasks,
    isTasksError,
    tasksError,
    refetchTasks,
  } = useColumnTasks(column.boardId, column.id);

  const { ref, isDragging } = useSortable({
    id: column.id,
    index,
    group: "columns",
    type: "column",
    accept: "column",
    collisionDetector: closestCenter,
    // Library defaults cover keyboard support and optimistic sorting; the DragOverlay renders the preview, and dragging stays gated behind canEdit.
    disabled: !canEdit ? { draggable: true } : false,
    data: {
      type: "column",
      columnId: column.id,
      columnName: column.name,
      taskCount: tasks.length,
    },
  });

  const { ref: taskDropRef, isDropTarget } = useDroppable({
    id: `task-container-${column.id}`,
    type: "task-container",
    accept: "task",
    data: {
      type: "task-container",
      columnId: column.id,
    },
  });

  const filterActive = !!filter && isTaskFilterActive(filter);
  const visibleTasks = filterActive
    ? tasks.filter((task) => matchesTaskFilter(task, filter))
    : tasks;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // While a task from ANOTHER column is dragged over this column, compute the
  // live insertion index from the pointer so an in-list placeholder can "push"
  // this column's tasks apart and preview exactly where the task will land.
  // This deliberately keeps cross-column task cards as non-targets: letting
  // dnd-kit's sortable run across columns would physically reparent the card
  // into this column's DOM, which conflicts with React's reconciliation
  // ("node to be removed is not a child of this node"). The placeholder only
  // re-renders this column's list, and the index matches the one the board
  // drop handler computes on drop.
  const manager = useDragDropManager();
  const { value: foreignTaskInsertionIndex } = useComputed(() => {
    if (!manager) return -1;

    const source = manager.dragOperation.source;
    const target = manager.dragOperation.target;
    if (
      source?.data?.type !== "task" ||
      target?.data?.type !== "task-container"
    ) {
      return -1;
    }

    const sourceColumnId = String(source.data.columnId ?? "");
    const targetColumnId = String(target.data.columnId ?? target.id ?? "");
    if (!sourceColumnId || sourceColumnId === column.id) return -1;
    if (targetColumnId !== column.id) return -1;

    return countTasksAbovePointer(
      collectColumnTaskEntries(manager, column.id),
      manager.dragOperation.position.current.y,
    );
  }, [manager, column.id]);

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-xl border border-border bg-card",
        className,
        isDragging && "opacity-50",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="size-2 shrink-0 rounded-full bg-primary" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {column.name}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {filterActive
            ? `${visibleTasks.length} / ${tasks.length}`
            : tasks.length}
        </span>

        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {canEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Rename
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setIsDeleteDialogOpen(true);
                  }}
                  variant="destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        data-column-scroll
        data-column-id={column.id}
        ref={taskDropRef}
        className={cn(
          "flex h-full min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain p-3 pt-6 transition-colors",
          isDropTarget && "bg-primary/5",
        )}
      >
        {isLoadingTasks ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span className="sr-only">Loading tasks…</span>
          </div>
        ) : isTasksError ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Couldn't load tasks.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchTasks();
              }}
            >
              Retry
            </Button>
            <span className="sr-only">{describeLoadError(tasksError)}</span>
          </div>
        ) : visibleTasks.length === 0 ? (
          foreignTaskInsertionIndex >= 0 ? (
            <TaskDropPlaceholder />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              {filterActive ? "No matching tasks" : "No tasks yet"}
            </p>
          )
        ) : (
          <>
            {visibleTasks.map((task, index) => (
              <Fragment key={task.id}>
                {foreignTaskInsertionIndex === index && (
                  <TaskDropPlaceholder />
                )}
                <TaskCard
                  task={task}
                  boardId={column.boardId}
                  canEdit={canEditTask}
                  canDelete={canDeleteTask}
                  draggable={canEditTask && !filterActive}
                  index={index}
                />
              </Fragment>
            ))}

            {foreignTaskInsertionIndex >= visibleTasks.length && (
              <TaskDropPlaceholder />
            )}
          </>
        )}
      </div>

      {canCreateTask && (
        <div className="shrink-0 border-t border-border p-2">
          <CreateTaskDialog boardId={column.boardId} columnId={column.id} />
        </div>
      )}

      {/* Dialogs rendered outside the unmounting menu */}
      {canEdit && (
        <EditColumnDialog
          column={column}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}

      {canDelete && (
        <ConfirmDeleteDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title="Delete Column"
          description={`Are you sure you want to delete "${column.name}"? This will permanently delete all tasks within this column.`}
          onConfirm={() => deleteColumn(column.id)}
          isLoading={isDeletingColumn}
        />
      )}
    </div>
  );
}
