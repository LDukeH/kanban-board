import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useBoard } from "@/hooks/useBoard";
import { reportMutationError } from "@/lib/httpStatus";

interface CreateColumnDialogProps {
  boardId: string;
  trigger?: React.ReactElement;
}

export function CreateColumnDialog({
  boardId,
  trigger,
}: CreateColumnDialogProps) {
  const { createColumn, isCreatingColumn } = useBoard(boardId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Column name is required.");
      return;
    }
    setError(null);
    try {
      await createColumn({ name: name.trim() });
      setName("");
      setOpen(false);
    } catch (err) {
      setError("Failed to create column. Please try again.");
      reportMutationError("Create column failed", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline">
              <Plus className="size-4" />
              Add Column
            </Button>
          )
        }
      />
      <DialogPopup>
        <DialogTitle>Create Column</DialogTitle>
        <DialogDescription>
          A column is an ordered workflow stage in this board.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="column-name">Name</Label>
            <Input
              id="column-name"
              placeholder="e.g. To Do"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isCreatingColumn}>
              {isCreatingColumn && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
