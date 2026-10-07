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
import { isStaleError, reportMutationError } from "@/lib/httpStatus";
import type { Column } from "@/types/board";

interface EditColumnDialogProps {
  column: Column;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement;
}

export function EditColumnDialog({
  column,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: EditColumnDialogProps) {
  const { updateColumn, isUpdatingColumn } = useBoard(column.boardId);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (isControlled) {
      setControlledOpen?.(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  };

  const [name, setName] = useState(column.name);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
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
        data: { name: name.trim(), version: column.version },
      });
      setOpen(false);
    } catch (err) {
      setError(
        isStaleError(err)
          ? "This column changed somewhere else. The list will refresh — please try again."
          : "Failed to update column. Please try again.",
      );
      reportMutationError("Update column failed", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        !isControlled && (
          <DialogTrigger
            render={
              <Button variant="ghost" size="icon-xs">
                <Pencil className="size-3" />
              </Button>
            }
          />
        )
      )}
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
