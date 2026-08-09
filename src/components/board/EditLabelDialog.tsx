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
import { LabelColorPicker } from "@/components/board/LabelColorPicker";
import type { Label as LabelModel } from "@/types/board";

interface EditLabelDialogProps {
  label: LabelModel;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement;
}

export function EditLabelDialog({
  label,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: EditLabelDialogProps) {
  const { updateLabel, isUpdatingLabel } = useBoard(label.boardId);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (nextOpen: boolean) => {
    if (isControlled) setControlledOpen?.(nextOpen);
    else setInternalOpen(nextOpen);
  };

  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setName(label.name);
      setColor(label.color);
      setError(null);
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Label name is required.");
      return;
    }
    setError(null);
    try {
      await updateLabel({ labelId: label.id, data: { name: name.trim(), color } });
      setOpen(false);
    } catch (err) {
      setError("Failed to update label. Please try again.");
      console.error("Update label failed:", err);
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
        <DialogTitle>Edit Label</DialogTitle>
        <DialogDescription>Update the name or color of this label.</DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edit-label-name-${label.id}`}>Name</Label>
            <Input
              id={`edit-label-name-${label.id}`}
              placeholder="e.g. Bug"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <LabelColorPicker value={color} onChange={setColor} disabled={isUpdatingLabel} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isUpdatingLabel}>
              {isUpdatingLabel && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
