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
import { LabelColorPicker } from "@/components/board/LabelColorPicker";
import { LABEL_NO_COLOR } from "@/lib/colors";

interface CreateLabelDialogProps {
  boardId: string;
  trigger?: React.ReactElement;
}

export function CreateLabelDialog({ boardId, trigger }: CreateLabelDialogProps) {
  const { createLabel, isCreatingLabel } = useBoard(boardId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_NO_COLOR);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Label name is required.");
      return;
    }
    setError(null);
    try {
      await createLabel({ name: name.trim(), color });
      setName("");
      setColor(LABEL_NO_COLOR);
      setOpen(false);
    } catch (err) {
      setError("Failed to create label. Please try again.");
      console.error("Create label failed:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <Plus className="size-4" />
              New Label
            </Button>
          )
        }
      />
      <DialogPopup>
        <DialogTitle>Create Label</DialogTitle>
        <DialogDescription>
          Labels are board-wide tags that can be attached to tasks.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="label-name">Name</Label>
            <Input
              id="label-name"
              placeholder="e.g. Bug, Feature..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <LabelColorPicker value={color} onChange={setColor} disabled={isCreatingLabel} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isCreatingLabel}>
              {isCreatingLabel && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
