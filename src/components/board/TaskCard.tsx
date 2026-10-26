import { useState } from "react";
import { cn } from "@/lib/utils";
import { getDescriptionPreview } from "@/lib/description";
import { isOverdue } from "@/lib/summary";
import { splitTaskLabels } from "@/lib/taskLabels";
import type { Task, TaskPriority } from "@/types/board";
import { EditTaskDialog } from "@/components/dialog/EditTaskDialog";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { closestCenter } from "@dnd-kit/collision";
import { useDragOperation } from "@dnd-kit/react";
import {
  AlertCircle,
  CalendarDays,
  Clock,
  Flag,
  GripVertical,
} from "lucide-react";
import { TaskAssigneeAvatars } from "@/components/board/TaskAssigneeAvatars";
import { TaskCompleteToggle } from "@/components/board/TaskCompleteToggle";
import { LabelBadge } from "@/components/board/LabelBadge";
import { useToggleTaskCompleted } from "@/hooks/useColumnTasks";
import { describeMutationError } from "@/lib/httpStatus";
import { getDateFormat } from "@/lib/preferences";

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

/** Colour-coded priority chips: High = danger, Medium = warning, Low = neutral. */
const PRIORITY_CHIP: Record<TaskPriority, string> = {
  none: "border-border bg-muted text-muted-foreground",
  low: "border-border bg-muted/60 text-muted-foreground",
  medium: "border-warning/20 bg-warning/5 text-warning",
  high: "border-danger/20 bg-danger/5 text-danger",
};

/** Formats a "YYYY-MM-DD" due date for display. Parsed by hand so it never shifts a day in negative UTC offsets. */
function formatDueDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const dateFormat = getDateFormat();
  return dateFormat === "DD/MM/YYYY"
    ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`
    : `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
}

/** True when a "YYYY-MM-DD" due date lands today or tomorrow — i.e. within the next 48 hours at local-midnight granularity. */
function isDueSoon(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const due = new Date(year, month - 1, day).getTime();
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const diffDays = Math.round((due - today) / 86_400_000);
  return diffDays >= 0 && diffDays <= 1;
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
  const { ref, handleRef, isDragging, isDragSource, isDropTarget, sortable } =
    useSortable({
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
  const toggleCompleted = useToggleTaskCompleted(boardId, task.columnId);
  const [toggleError, setToggleError] = useState<string | null>(null);

  function handleToggleCompleted() {
    setToggleError(null);
    // Optimistic update + rollback live in useToggleTaskCompleted; surface a failure inline so it is not silent.
    void toggleCompleted
      .mutateAsync({ taskId: task.id, completed: !task.completed })
      .catch((error: unknown) => {
        setToggleError(
          describeMutationError(
            error,
            "Could not update the task. Please try again.",
          ),
        );
      });
  }

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
  const dueSoon =
    !task.completed && !overdue && task.dueDate
      ? isDueSoon(task.dueDate)
      : false;

  return (
    <div
      ref={ref}
      className={cn(
        "group relative flex  items-start gap-2 rounded-card border border-border/80 bg-background px-3 py-2.5 pr-8 transition-shadow hover:shadow-sm",
        className,
        isDragging && "opacity-40 shadow-md",
        isOverlay && "rotate-1 border-primary/40 shadow-lg",
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

      {!isOverlay && draggable && (
        <button
          ref={handleRef}
          type="button"
          className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 touch-none items-center justify-center rounded text-slate-400 opacity-0 outline-none transition-[background-color,color,opacity] hover:bg-slate-100 hover:text-slate-600 hover:cursor-grab focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          aria-label={`Drag task ${task.title}`}
          title="Drag task"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}

      <div className="min-w-0 flex-1 pl-2 pr-1">
        <div className="flex items-start gap-1.5">
          <TaskCompleteToggle
            completed={task.completed}
            taskTitle={task.title}
            onToggle={handleToggleCompleted}
            disabled={toggleCompleted.isPending}
            className="mt-0.5"
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
                    "line-clamp-2 min-w-0 flex-1 text-left text-sm font-medium hover:text-primary",
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
                "line-clamp-2 min-w-0 flex-1 text-sm font-medium",
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

        {(task.labels ?? []).length > 0 &&
          (() => {
            const labels = task.labels ?? [];
            const { visible, hidden } = splitTaskLabels(labels);
            return (
              <div
                className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] lg:text-sm text-muted-foreground"
                aria-label={`Labels: ${labels.map((label) => label.name).join(", ")}`}
              >
                {visible.map((label) => (
                  <LabelBadge
                    key={label.id}
                    label={label}
                    className="rounded px-2 py-0.5 text-[10px] font-medium lg:max-w-28 lg:text-[11px] lg:px-1.5 lg:py-0.5"
                  />
                ))}
                {hidden.length > 0 && (
                  <span
                    className="inline-flex h-5 shrink-0 items-center rounded border border-background bg-muted lg:text-[11px] px-1.5"
                    title={hidden.map((label) => label.name).join(", ")}
                  >
                    +{hidden.length}
                  </span>
                )}
              </div>
            );
          })()}

        {(task.priority !== "none" || task.dueDate) && (
          <div className="mt-1.5 flex flex-wrap items-center lg:gap-x-2.5 lg:gap-y-1 text-xs text-muted-foreground">
            {task.priority !== "none" && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border lg:rounded-control lg:px-1.5 lg:py-0.5 font-medium text-[10px] lg:text-sm",
                  PRIORITY_CHIP[task.priority],
                )}
                title={`Priority: ${PRIORITY_LABEL[task.priority]}`}
              >
                <Flag className="size-3" aria-hidden />
                {PRIORITY_LABEL[task.priority]}
              </span>
            )}

            {task.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium text-[10px] lg:text-sm",
                  overdue
                    ? "text-danger"
                    : dueSoon
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
                title={
                  overdue
                    ? `Overdue since ${formatDueDate(task.dueDate)}`
                    : dueSoon
                      ? `Due soon: ${formatDueDate(task.dueDate)}`
                      : `Due ${formatDueDate(task.dueDate)}`
                }
              >
                {overdue ? (
                  <AlertCircle className="size-3" aria-hidden />
                ) : dueSoon ? (
                  <Clock className="size-3" aria-hidden />
                ) : (
                  <CalendarDays className="size-3" aria-hidden />
                )}
                {/* The text carries the state, so the colour is never the only signal. */}
                {overdue
                  ? `Overdue · ${formatDueDate(task.dueDate)}`
                  : dueSoon
                    ? `Due soon · ${formatDueDate(task.dueDate)}`
                    : formatDueDate(task.dueDate)}
              </span>
            )}
          </div>
        )}
      </div>

      {!isOverlay && <TaskAssigneeAvatars assignees={task.assignees ?? []} />}

      {toggleError && (
        <p role="alert" className="mt-1.5 w-full text-xs text-destructive">
          {toggleError}
        </p>
      )}
    </div>
  );
}
