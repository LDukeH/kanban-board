import { cn } from "@/lib/utils";
import type { Task } from "@/types/board";
import { EditTaskDialog } from "@/components/board/EditTaskDialog";
import { useSortable } from "@dnd-kit/react/sortable";
import { closestCenter } from "@dnd-kit/collision";
import { TaskAssigneeAvatars } from "@/components/board/TaskAssigneeAvatars";

interface TaskCardProps {
  task: Task;
  boardId: string;
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
  index: number;
  isOverlay?: boolean;
}

export function TaskCard({
  task,
  boardId,
  canEdit = false,
  canDelete = false,
  className,
  index,
  isOverlay = false,
}: TaskCardProps) {
  const { ref, isDragging } = useSortable({
    id: task.id,
    index,
    type: "task",
    accept: "task",
    group: task.columnId,
    collisionDetector: closestCenter,
    disabled: isOverlay, // Prevents overlay from registering as a active sortable node
    data: { type: "task", task: task, columnId: task.columnId },
  });

  return (
    <div
      ref={isOverlay ? undefined : ref}
      className={cn(
        "group flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm transition-colors hover:border-primary/30",
        className,
        isDragging && "opacity-40",
        isOverlay && "shadow-lg border-primary/40 rotate-1",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-muted-foreground/40"
            aria-hidden
          />
          {canEdit && !isOverlay ? (
            <EditTaskDialog
              task={task}
              boardId={boardId}
              canDelete={canDelete}
              trigger={
                <button
                  type="button"
                  className="min-w-0 flex-1  truncate text-left text-sm font-medium text-foreground hover:text-primary"
                >
                  {task.title}
                </button>
              }
            />
          ) : (
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {task.title}
            </p>
          )}
        </div>
        {task.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {task.description}
          </p>
        ) : null}

        {(task.labels ?? []).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(task.labels ?? []).map((label) => (
              <span
                key={label.id}
                className="h-1.5 w-7 shrink-0 rounded-full"
                style={
                  label.color ? { backgroundColor: label.color } : undefined
                }
                title={label.name}
              />
            ))}
          </div>
        )}
      </div>

      {!isOverlay && <TaskAssigneeAvatars assignees={task.assignees ?? []} />}
    </div>
  );
}
