import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Plus, Check } from "lucide-react";
import { useColumnTasks } from "@/hooks/useColumnTasks";
import { useBoard } from "@/hooks/useBoard";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { CreateLabelDialog } from "@/components/board/CreateLabelDialog";
import type { Task } from "@/types/board";

interface EditTaskDialogProps {
  task: Task;
  boardId: string;
  trigger: React.ReactElement;
}

export function EditTaskDialog({
  task,
  boardId,
  trigger,
}: EditTaskDialogProps) {
  const { updateTask, isUpdatingTask, addLabelToTask, removeLabelFromTask } =
    useColumnTasks(boardId, task.columnId);
  const { board, labels, isLoadingLabels } = useBoard(boardId);
  const { canAssignLabels } = useWorkspaceAccess(board?.workspaceId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const [isCreateLabelOpen, setIsCreateLabelOpen] = useState(false);
  const [togglingLabelId, setTogglingLabelId] = useState<string | null>(null);

  const assignedLabelIds = useMemo(
    () => new Set((task.labels ?? []).map((l) => l.id)),
    [task.labels],
  );

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setError(null);
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    setError(null);
    try {
      await updateTask({
        taskId: task.id,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
        },
      });
      setOpen(false);
    } catch (err) {
      setError("Failed to update task. Please try again.");
      console.error("Update task failed:", err);
    }
  }

  async function handleToggleLabel(labelId: string) {
    setTogglingLabelId(labelId);
    try {
      if (assignedLabelIds.has(labelId)) {
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogPopup>
        <DialogTitle>Edit Task</DialogTitle>
        <DialogDescription>Update this task's details.</DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-task-title-${task.id}`}>Title</Label>
            <Input
              id={`edit-task-title-${task.id}`}
              placeholder="e.g. Design login page"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-task-description-${task.id}`}>
              Description (optional)
            </Label>
            <Textarea
              id={`edit-task-description-${task.id}`}
              placeholder="Add more details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Labels</Label>
            <div className="flex flex-wrap items-center gap-1">
              {(task.labels ?? []).map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                  style={
                    label.color
                      ? { backgroundColor: label.color }
                      : { backgroundColor: "#6b7280" }
                  }
                  title={label.name}
                >
                  {label.name}
                </span>
              ))}
              {canAssignLabels && (
                <DropdownMenu
                  open={isLabelMenuOpen}
                  onOpenChange={setIsLabelMenuOpen}
                >
                  <DropdownMenuTrigger>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-input bg-background text-xs text-muted-foreground transition-colors hover:bg-muted">
                      +
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {isLoadingLabels ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : labels.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">
                        No labels on this board yet.
                      </p>
                    ) : (
                      labels.map((label) => {
                        const assigned = assignedLabelIds.has(label.id);
                        const busy = togglingLabelId === label.id;
                        return (
                          <DropdownMenuItem
                            key={label.id}
                            disabled={busy}
                            onClick={() => handleToggleLabel(label.id)}
                            closeOnClick={false}
                            className="gap-2"
                          >
                            <span
                              className="size-3 shrink-0 rounded-full"
                              style={
                                label.color
                                  ? { backgroundColor: label.color }
                                  : undefined
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {label.name}
                            </span>
                            {busy ? (
                              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                            ) : assigned ? (
                              <Check className="size-3.5 shrink-0 text-primary" />
                            ) : null}
                          </DropdownMenuItem>
                        );
                      })
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsCreateLabelOpen(true)}>
                      <Plus className="size-3.5" />
                      Create new label
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isUpdatingTask}>
              {isUpdatingTask && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogPopup>
      <CreateLabelDialog
        boardId={boardId}
        open={isCreateLabelOpen}
        onOpenChange={setIsCreateLabelOpen}
      />
    </Dialog>
  );
}
