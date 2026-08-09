import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Check, Loader2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeLoadError } from "@/lib/httpStatus";
import { useBoard } from "@/hooks/useBoard";
import { useColumnTasks } from "@/hooks/useColumnTasks";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import type { Task } from "@/types/board";

interface LabelPickerProps {
  boardId: string;
  task: Task;
}

/**
 * Reusable task-label picker. Only uses Labels belonging to the task's Board,
 * lets the user add/remove labels, and prevents duplicate assignment. Hidden
 * for users who cannot assign labels (backend remains authoritative).
 */
export function LabelPicker({ boardId, task }: LabelPickerProps) {
  const { board, labels, isLoadingLabels, isLabelsError, labelsError } = useBoard(boardId);
  const { addLabelToTask, removeLabelFromTask } = useColumnTasks(boardId, task.columnId);
  const { canAssignLabels } = useWorkspaceAccess(board?.workspaceId);

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingLabelId, setTogglingLabelId] = useState<string | null>(null);

  if (!canAssignLabels) return null;

  const assignedIds = new Set((task.labels ?? []).map((label) => label.id));

  async function handleToggle(labelId: string) {
    const isAssigned = assignedIds.has(labelId);
    setTogglingLabelId(labelId);
    setError(null);
    try {
      if (isAssigned) {
        await removeLabelFromTask({ taskId: task.id, labelId });
      } else {
        await addLabelToTask({ taskId: task.id, labelId });
      }
    } catch (err) {
      setError("Failed to update labels. Please try again.");
      console.error("Label assignment failed:", err);
    } finally {
      setTogglingLabelId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Tag className="size-3" />
            Labels
          </Button>
        }
      />
      <DialogPopup>
        <DialogTitle>Labels</DialogTitle>
        <DialogDescription>
          Toggle labels on this task. Only labels from this board are available.
        </DialogDescription>

        {isLoadingLabels ? (
          <div className="mt-4 flex justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : isLabelsError ? (
          <p className="mt-4 text-xs text-destructive">{describeLoadError(labelsError)}</p>
        ) : labels.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            This board has no labels yet.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-1.5">
            {labels.map((label) => {
              const assigned = assignedIds.has(label.id);
              const busy = togglingLabelId === label.id;
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => handleToggle(label.id)}
                  disabled={busy}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
                    assigned ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted",
                    busy && "opacity-60",
                  )}
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={label.color ? { backgroundColor: label.color } : undefined}
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground">{label.name}</span>
                  {busy ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : assigned ? (
                    <Check className="size-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
        <div className="mt-4 flex justify-end">
          <DialogClose render={<Button variant="ghost" />}>Done</DialogClose>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
