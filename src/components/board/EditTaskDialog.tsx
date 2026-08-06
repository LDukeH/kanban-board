import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { useColumnTasks } from "@/hooks/useColumnTasks";
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
  const { updateTask, isUpdatingTask } = useColumnTasks(boardId, task.columnId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [error, setError] = useState<string | null>(null);

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
    </Dialog>
  );
}
