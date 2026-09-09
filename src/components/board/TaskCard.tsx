import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/board";
import { EditTaskDialog } from "@/components/dialog/EditTaskDialog";
import { useSortable } from "@dnd-kit/react/sortable";
import { SortableKeyboardPlugin } from "@dnd-kit/dom/sortable";
import { Feedback } from "@dnd-kit/dom";
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
  dragPointerY?: number | null;
}

export function TaskCard({
  task,
  boardId,
  canEdit = false,
  canDelete = false,
  className,
  index,
  isOverlay = false,
  dragPointerY = null,
}: TaskCardProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const { ref, isDragging, isDropTarget } = useSortable({
    id: task.id,
    index,
    type: "task",
    accept: "task",
    group: task.columnId,
    collisionDetector: closestCenter,
    plugins: [
      SortableKeyboardPlugin,
      Feedback.configure({ feedback: "clone" }),
    ],
    disabled: isOverlay, // Prevents overlay from registering as a active sortable node
    data: { type: "task", task: task, columnId: task.columnId },
  });

  const setElementRefs = useCallback(
    (element: HTMLDivElement | null) => {
      setTargetRect(element?.getBoundingClientRect() ?? null);
      if (!isOverlay) ref(element);
    },
    [isOverlay, ref],
  );
  const targetMidpoint = targetRect
    ? targetRect.top + targetRect.height / 2
    : null;

  const isDropBelow =
    !isOverlay &&
    isDropTarget &&
    dragPointerY !== null &&
    targetMidpoint !== null &&
    dragPointerY >= targetMidpoint;

  return (
    <div
      ref={setElementRefs}
      className={cn(
        "group relative flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm transition-colors hover:border-primary/30",
        className,
        isDragging && "opacity-40",
        isOverlay && "shadow-lg border-primary/40 rotate-1",
      )}
    >
      {!isOverlay && isDropTarget && (
        <span
          aria-label={`Task will be inserted ${isDropBelow ? "after" : "before"} this task`}
          className={cn(
            "pointer-events-none absolute right-1.5 left-1.5 z-10 h-1 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--background))]",
            isDropBelow ? "-bottom-1.5" : "-top-1.5",
          )}
        />
      )}

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
