import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function EditTaskLabelPicker({
  boardId,
  task,
}: EditTaskLabelPickerProps) {
  const [togglingLabelId, setTogglingLabelId] = useState<string | null>(null);

  const { labels, board, isLoadingLabels } = useBoard(boardId);
  const { addLabelToTask, removeLabelFromTask } = useColumnTasks(
    boardId,
    task.columnId,
  );
  const { canAssignLabels } = useWorkspaceAccess(board?.workspaceId);

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
    <DropdownMenu>
      <DropdownMenuTrigger>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted">
          Labels
          {selectedCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
              {selectedCount}
            </span>
          )}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {isLoadingLabels ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : labels.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            This board has no labels yet.
          </p>
        ) : (
          labels.map((label) => {
            const isAssigned = assignedIds.has(label.id);
            const isBusy = togglingLabelId === label.id;
            return (
              <DropdownMenuItem
                key={label.id}
                disabled={isBusy}
                onClick={() => handleToggle(label.id)}
                closeOnClick={false}
                className="gap-2"
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
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
