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
import { Pencil, Loader2 } from "lucide-react";
import { useBoard } from "@/hooks/useBoard";
import type { Column } from "@/types/board";

interface EditColumnDialogProps {
  column: Column;
  trigger?: React.ReactElement;
}

export function EditColumnDialog({ column, trigger }: EditColumnDialogProps) {
  const { updateColumn, isUpdatingColumn } = useBoard(column.boardId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(column.name);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Reset form field to current column value when opening
      setName(column.name);
      setError(null);
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Column name is required.");
      return;
    }
    setError(null);
    try {
      await updateColumn({
        columnId: column.id,
        data: { name: name.trim() },
      });
      setOpen(false);
    } catch (err) {
      setError("Failed to update column. Please try again.");
      console.error("Update column failed:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="ghost" size="icon-xs">
              <Pencil className="size-3" />
            </Button>
          )
        }
      />
      <DialogPopup>
        <DialogTitle>Edit Column</DialogTitle>
        <DialogDescription>Update the name of this column.</DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-column-name">Name</Label>
            <Input
              id="edit-column-name"
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
            <Button type="submit" disabled={isUpdatingColumn}>
              {isUpdatingColumn && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
