import { useState } from "react";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import type { Column } from "@/types/board";
import { useSortable } from "@dnd-kit/react/sortable";
import { closestCenter } from "@dnd-kit/collision";
import { EditColumnDialog } from "@/components/board/EditColumnDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { CreateTaskDialog } from "@/components/board/CreateTaskDialog";
import { TaskCard } from "@/components/board/TaskCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoard } from "@/hooks/useBoard";
import { useColumnTasks } from "@/hooks/useColumnTasks";
import { useDroppable } from "@dnd-kit/react";
import {
  isTaskFilterActive,
  matchesTaskFilter,
  type TaskFilter,
} from "@/lib/taskFilter";

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
  const { ref, isDragging } = useSortable({
    id: column.id,
    index,
    type: "column",
    accept: "column",
    collisionDetector: closestCenter,
    data: { type: "column", columnId: column.id },
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

  const { deleteColumn, isDeletingColumn } = useBoard(column.boardId);
  const { tasks, isLoadingTasks } = useColumnTasks(column.boardId, column.id);

  const filterActive = !!filter && isTaskFilterActive(filter);
  const visibleTasks = filterActive
    ? tasks.filter((task) => matchesTaskFilter(task, filter))
    : tasks;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-xl border border-border bg-card",
        className,
        isDragging && "opacity-50",
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="size-2 shrink-0 rounded-full bg-primary" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {column.name}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {filterActive ? `${visibleTasks.length} / ${tasks.length}` : tasks.length}
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

      {/* Task area */}
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
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : visibleTasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {filterActive ? "No matching tasks" : "No tasks yet"}
          </p>
        ) : (
          visibleTasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              boardId={column.boardId}
              canEdit={canEditTask}
              canDelete={canDeleteTask}
              index={index}
            />
          ))
        )}
      </div>

      {/* Footer */}
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
