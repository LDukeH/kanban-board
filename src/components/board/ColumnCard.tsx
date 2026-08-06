import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import type { Column } from "@/types/board";
import { useSortable } from "@dnd-kit/react/sortable";
import { EditColumnDialog } from "@/components/board/EditColumnDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { CreateTaskDialog } from "@/components/board/CreateTaskDialog";
import { TaskCard } from "@/components/board/TaskCard";
import { Button } from "@/components/ui/button";
import { useBoard } from "@/hooks/useBoard";
import { useColumnTasks } from "@/hooks/useColumnTasks";

interface ColumnCardProps {
  column: Column;
  className?: string;
  index: number;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreateTask?: boolean;
  canEditTask?: boolean;
  canDeleteTask?: boolean;
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
}: ColumnCardProps) {
  const { ref, isDragging } = useSortable({ id: column.id, index });
  const { deleteColumn, isDeletingColumn } = useBoard(column.boardId);
  const { tasks, isLoadingTasks } = useColumnTasks(column.boardId, column.id);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const showMenu = canEdit || canDelete;

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-xl border border-border bg-card",
        className,
        isDragging && "opacity-50",
      )}
    >
      {/* Header — stays fixed while tasks scroll */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="size-2 shrink-0 rounded-full bg-primary" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {column.name}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>

        {showMenu && (
          <div className="relative" ref={menuRef}>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Column actions"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 min-w-36 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-md"
              >
                {canEdit && (
                  <EditColumnDialog
                    column={column}
                    trigger={
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                        onClick={() => setMenuOpen(false)}
                      >
                        <Pencil className="size-3.5" />
                        Rename
                      </button>
                    }
                  />
                )}
                {canDelete && (
                  <ConfirmDeleteDialog
                    title="Delete Column"
                    description={`Are you sure you want to delete "${column.name}"? This will permanently delete all tasks within this column.`}
                    onConfirm={() => deleteColumn(column.id)}
                    isLoading={isDeletingColumn}
                    trigger={
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted"
                        onClick={() => setMenuOpen(false)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    }
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable task area — vertical scroll only; does not grow the column */}
      <div
        data-column-scroll
        className="flex min-h-0  flex-col gap-2 overflow-y-auto overscroll-contain p-3"
      >
        {isLoadingTasks ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No tasks yet
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              boardId={column.boardId}
              canEdit={canEditTask}
              canDelete={canDeleteTask}
            />
          ))
        )}
      </div>

      {/* Footer — stays fixed while tasks scroll */}
      {canCreateTask && (
        <div className="shrink-0 border-t border-border p-2">
          <CreateTaskDialog boardId={column.boardId} columnId={column.id} />
        </div>
      )}
    </div>
  );
}
