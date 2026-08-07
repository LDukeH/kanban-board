import { cn } from "@/lib/utils";
import type { Task } from "@/types/board";
import { EditTaskDialog } from "@/components/board/EditTaskDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { useColumnTasks } from "@/hooks/useColumnTasks";
import { Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/react/sortable";
import { closestCenter } from "@dnd-kit/collision";

interface TaskCardProps {
  task: Task;
  boardId: string;
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
  index: number;
}

export function TaskCard({
  task,
  boardId,
  canEdit = false,
  canDelete = false,
  className,
  index,
}: TaskCardProps) {
  const { deleteTask, isDeletingTask } = useColumnTasks(boardId, task.columnId);
  const { ref, isDragging } = useSortable({
    id: task.id,
    index,
    type: "task",
    accept: "task",
    group: task.columnId,
    collisionDetector: closestCenter,
    data: { type: "task", taskId: task.id, columnId: task.columnId },
  });

  return (
    <div
      ref={ref}
      className={cn(
        "group flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm transition-colors hover:border-primary/30",
        className,
        isDragging && "opacity-50",
      )}
    >
      {/* Visual status indicator — backend has no done/status field yet */}
      <span
        className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-muted-foreground/40"
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        {canEdit ? (
          <EditTaskDialog
            task={task}
            boardId={boardId}
            trigger={
              <button
                type="button"
                className="w-full truncate text-left text-sm font-medium text-foreground hover:text-primary"
              >
                {task.title}
              </button>
            }
          />
        ) : (
          <p className="truncate text-sm font-medium text-foreground">
            {task.title}
          </p>
        )}
        {task.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {task.description}
          </p>
        ) : null}
      </div>

      {canDelete && (
        <ConfirmDeleteDialog
          title="Delete Task"
          description={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
          onConfirm={() => deleteTask(task.id)}
          isLoading={isDeletingTask}
          trigger={
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Delete ${task.title}`}
            >
              <Trash2 className="size-3" />
            </Button>
          }
        />
      )}
    </div>
  );
}
