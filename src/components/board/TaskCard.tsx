import { cn } from "@/lib/utils";
import { getDescriptionPreview } from "@/lib/description";
import { isOverdue } from "@/lib/summary";
import type { Task, TaskPriority } from "@/types/board";
import { EditTaskDialog } from "@/components/dialog/EditTaskDialog";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { closestCenter } from "@dnd-kit/collision";
import { useDragOperation } from "@dnd-kit/react";
import { TaskAssigneeAvatars } from "@/components/board/TaskAssigneeAvatars";
import { AlertCircle, CalendarDays, CheckCircle2, Flag } from "lucide-react";

interface TaskCardProps {
  task: Task;
  boardId: string;
  canEdit?: boolean;
  canDelete?: boolean;
  draggable?: boolean;
  className?: string;
  index: number;
  isOverlay?: boolean;
}

/** Visible text per priority, so the badge never relies on colour alone. */
const PRIORITY_LABEL: Record<TaskPriority, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Formats a "YYYY-MM-DD" due date for display.
 *
 * The parts are parsed by hand and fed to the local-time Date constructor:
 * `new Date("2026-10-02")` is parsed as UTC midnight, which renders as the
 * previous day for anyone west of UTC.
 */
function formatDueDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TaskCard({
  task,
  boardId,
  canEdit = false,
  canDelete = false,
  draggable = true,
  className,
  index,
  isOverlay = false,
}: TaskCardProps) {
  // Task-to-task drops are scoped to THIS column so dnd-kit's live reordering stays in one DOM container.
  // Cross-column drops route through the target column's task-container droppable, which the board handler resolves into a
  // pointer-based position; this avoids dnd-kit reparenting the card, which would break React's reconciliation.
  const { ref, isDragging, isDragSource, isDropTarget, sortable } = useSortable({
    id: task.id,
    index,
    type: "task",
    accept: (draggable) =>
      draggable.data?.type === "task" &&
      draggable.data?.columnId === task.columnId,
    group: task.columnId,
    collisionDetector: closestCenter,
    // Overlay cards must never register as active sortable nodes.
    disabled: isOverlay
      ? { draggable: true, droppable: true }
      : { draggable: !draggable },
    data: { type: "task", task: task, columnId: task.columnId },
  });

  const { source } = useDragOperation();

  // While dragging, the sortable plugin syncs the dragged task's index with the render order, so comparing it with this card's index matches the final drop.
  const showInsertionIndicator =
    !isOverlay &&
    !isDragSource &&
    isDropTarget &&
    source?.data?.type === "task" &&
    isSortable(source);
  const isDropBelow =
    showInsertionIndicator && source.sortable.index > sortable.index;

  const preview = getDescriptionPreview(task.description);
  const overdue = isOverdue(task);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm transition-colors hover:border-primary/30",
        className,
        isDragging && "opacity-40",
        isOverlay && "shadow-lg border-primary/40 rotate-1",
      )}
    >
      {showInsertionIndicator && (
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
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary",
                    task.completed
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                >
                  {task.title}
                </button>
              }
            />
          ) : (
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-medium",
                task.completed
                  ? "text-muted-foreground line-through"
                  : "text-foreground",
              )}
            >
              {task.title}
            </p>
          )}
        </div>
        {preview ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {preview}
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

        {(task.priority !== "none" || task.dueDate || task.completed) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
            {task.priority !== "none" && (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 font-medium text-muted-foreground"
                title={`Priority: ${PRIORITY_LABEL[task.priority]}`}
              >
                <Flag className="size-3" aria-hidden />
                {PRIORITY_LABEL[task.priority]}
              </span>
            )}

            {task.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium",
                  overdue ? "text-destructive" : "text-muted-foreground",
                )}
                title={
                  overdue
                    ? `Overdue since ${formatDueDate(task.dueDate)}`
                    : `Due ${formatDueDate(task.dueDate)}`
                }
              >
                {overdue ? (
                  <AlertCircle className="size-3" aria-hidden />
                ) : (
                  <CalendarDays className="size-3" aria-hidden />
                )}
                {/* The word "Overdue" is the primary signal; the colour is secondary. */}
                {overdue
                  ? `Overdue · ${formatDueDate(task.dueDate)}`
                  : formatDueDate(task.dueDate)}
              </span>
            )}

            {task.completed && (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3" aria-hidden />
                Done
              </span>
            )}
          </div>
        )}
      </div>

      {!isOverlay && <TaskAssigneeAvatars assignees={task.assignees ?? []} />}
    </div>
  );
}
