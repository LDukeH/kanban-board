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
import { toast } from "react-toastify";
import { useBoards } from "@/hooks/useBoards";
import type { Board } from "@/types/board";

interface EditBoardDialogProps {
  board: Board;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditBoardDialog({
  board,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: EditBoardDialogProps) {
  const { updateBoard, isUpdatingBoard } = useBoards(board.workspaceId);
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (isControlled) {
      setControlledOpen?.(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  };

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Reset form fields to current board values when opening
      setName(board.name);
      setDescription(board.description ?? "");
      setError(null);
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Board name is required.");
      return;
    }
    setError(null);
    try {
      const updated = await updateBoard({
        boardId: board.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
        },
      });
      setOpen(false);
      toast.success(`“${updated.name}” updated`);
    } catch (err) {
      setError("Failed to update board. Please try again.");
      console.error("Update board failed:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogPopup>
        <DialogTitle>Edit Board</DialogTitle>
        <DialogDescription>
          Update the name or description of this board.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-board-name">Name</Label>
            <Input
              id="edit-board-name"
              placeholder="e.g. Product Launch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-board-description">
              Description (optional)
            </Label>
            <Textarea
              id="edit-board-description"
              placeholder="What is this board for?"
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
            <Button type="submit" disabled={isUpdatingBoard}>
              {isUpdatingBoard && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
