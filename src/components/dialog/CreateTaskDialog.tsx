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
import { Plus, Loader2 } from "lucide-react";
import { useColumnTasks } from "@/hooks/useColumnTasks";
import { reportMutationError } from "@/lib/httpStatus";
import { textToTaskDescription } from "@/lib/description";
import { TASK_PRIORITIES, type TaskPriority } from "@/types/board";
import { cn } from "@/lib/utils";

interface CreateTaskDialogProps {
  boardId: string;
  columnId: string;
  trigger?: React.ReactElement;
}

export function CreateTaskDialog({
  boardId,
  columnId,
  trigger,
}: CreateTaskDialogProps) {
  const { createTask, isCreatingTask } = useColumnTasks(boardId, columnId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("none");
  /** "YYYY-MM-DD" from <input type="date">, or "" for no due date. */
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setTitle("");
      setDescription("");
      setPriority("none");
      setDueDate("");
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
      await createTask({
        title: title.trim(),
        description: description.trim()
          ? textToTaskDescription(description)
          : undefined,
        priority,
        // An empty date input means "no due date"; null stores NULL on create.
        // New tasks always start incomplete; completion is toggled from the card circle.
        dueDate: dueDate || null,
      });
      setTitle("");
      setDescription("");
      setPriority("none");
      setDueDate("");
      setOpen(false);
    } catch (err) {
      setError("Failed to create task. Please try again.");
      reportMutationError("Create task failed", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button
              variant="ghost"
              className="h-8 w-full justify-start gap-1.5 px-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
              Add task
            </Button>
          )
        }
      />
      <DialogPopup>
        <DialogTitle>Create Task</DialogTitle>
        <DialogDescription>Add a new task to this column.</DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="e.g. Design login page"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">Description (optional)</Label>
            <Textarea
              id="task-description"
              placeholder="Add more details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span id="task-priority-label" className="text-sm font-medium">
              Priority
            </span>
            <div
              role="group"
              aria-labelledby="task-priority-label"
              className="flex flex-wrap gap-1.5"
            >
              {TASK_PRIORITIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={priority === option}
                  onClick={() => setPriority(option)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                    priority === option
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="task-due-date">Due date (optional)</Label>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isCreatingTask}>
              {isCreatingTask && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
