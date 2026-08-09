import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoard } from "@/hooks/useBoard";
import { useColumnTasks } from "@/hooks/useColumnTasks";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import type { Label } from "@/types/board";

interface EditTaskLabelPickerProps {
  boardId: string;
  task: {
    id: string;
    columnId: string;
    labels?: Label[];
  };
}

/**
 * Multi-select label picker used inside EditTaskDialog.
 * Lets the user toggle labels on/off for the current task.
 */
export function EditTaskLabelPicker({
  boardId,
  task,
}: EditTaskLabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [togglingLabelId, setTogglingLabelId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { labels, isLoadingLabels } = useBoard(boardId);
  const { addLabelToTask, removeLabelFromTask } = useColumnTasks(boardId, task.columnId);
  const { canAssignLabels } = useWorkspaceAccess(task.labels?.[0]?.boardId ?? boardId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (!canAssignLabels) return null;

  const assignedIds = new Set((task.labels ?? []).map((l) => l.id));
  const selectedCount = assignedIds.size;

  async function handleToggle(labelId: string) {
    const isAssigned = assignedIds.has(labelId);
    setTogglingLabelId(labelId);
    try {
      if (isAssigned) {
        await removeLabelFromTask({ taskId: task.id, labelId });
      } else {
        await addLabelToTask({ taskId: task.id, labelId });
      }
    } catch (err) {
      console.error("Label toggle failed:", err);
    } finally {
      setTogglingLabelId(null);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="text-xs text-muted-foreground">Labels</span>
        {selectedCount > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
            {selectedCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-border bg-card shadow-lg">
          <div className="max-h-72 overflow-y-auto px-1.5 py-1">
            {isLoadingLabels ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : labels.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                This board has no labels yet.
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {labels.map((label) => {
                  const isAssigned = assignedIds.has(label.id);
                  const isBusy = togglingLabelId === label.id;
                  return (
                    <button
                      key={label.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggle(label.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        isAssigned ? "bg-primary/5" : "hover:bg-muted",
                        isBusy && "opacity-60",
                      )}
                    >
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={
                          label.color ? { backgroundColor: label.color } : undefined
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{label.name}</span>
                      {isBusy ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                      ) : isAssigned ? (
                        <Check className="size-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
