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
import { Pencil, Loader2 } from "lucide-react";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import type { Workspace } from "@/types/workspace";

interface EditWorkspaceDialogProps {
  workspace: Workspace;
  trigger?: React.ReactElement;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditWorkspaceDialog({
  workspace,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: EditWorkspaceDialogProps) {
  const { updateWorkspace, isUpdating } = useWorkspaces();
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? "");
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
      // Reset form fields to current workspace values when opening
      setName(workspace.name);
      setDescription(workspace.description ?? "");
      setError(null);
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Workspace name is required.");
      return;
    }
    setError(null);
    try {
      await updateWorkspace({
        workspaceId: workspace.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
        },
      });
      setOpen(false);
    } catch (err) {
      setError("Failed to update workspace. Please try again.");
      console.error("Update workspace failed:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="ghost" size="icon-xs" className="text-white">
              <Pencil className="size-3" />
            </Button>
          )
        }
      />
      <DialogPopup>
        <DialogTitle>Edit Workspace</DialogTitle>
        <DialogDescription>
          Update the name or description of this workspace.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-workspace-name">Name</Label>
            <Input
              id="edit-workspace-name"
              placeholder="e.g. University Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-workspace-description">
              Description (optional)
            </Label>
            <Textarea
              id="edit-workspace-description"
              placeholder="What is this workspace for?"
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
            <Button type="submit" disabled={isUpdating}>
              {isUpdating && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
