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
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { describeMutationError } from "@/lib/httpStatus";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_DESCRIPTION_MAX_BYTES,
  WORKSPACE_DESCRIPTION_MAX_CHARS,
  descriptionByteLength,
  normalizeWorkspaceDescription,
  validateWorkspaceDescription,
} from "@/lib/validations/workspace.schema";
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
  const [description, setDescription] = useState(workspace.description);
  const [error, setError] = useState<string | null>(null);

  const descriptionBytes = descriptionByteLength(description);
  const isDescriptionTooLong =
    descriptionBytes > WORKSPACE_DESCRIPTION_MAX_BYTES;

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
      setName(workspace.name);
      setDescription(workspace.description);
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
    const descriptionError = validateWorkspaceDescription(description);
    if (descriptionError) {
      setError(descriptionError);
      return;
    }
    setError(null);
    try {
      await updateWorkspace({
        workspaceId: workspace.id,
        data: {
          // The backend still requires `name` on PATCH, so it always travels
          // with a description change.
          name: name.trim(),
          // `""` clears the stored description; omitting the key would leave it
          // untouched, so a blank field is never sent as undefined.
          description: normalizeWorkspaceDescription(description),
        },
      });
      setOpen(false);
    } catch (err) {
      // Error bodies are plain text (`validation failed`, `forbidden`, the
      // non-owner 500, …), so the backend message is surfaced as-is.
      setError(
        describeMutationError(
          err,
          "Failed to update workspace. Please try again.",
        ),
      );
      console.error("Update workspace failed:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-workspace-description">
                Description (optional)
              </Label>
              {/* Byte counter, not a character counter: the backend caps the
                  stored description at 2000 bytes. */}
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  isDescriptionTooLong
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {descriptionBytes}/{WORKSPACE_DESCRIPTION_MAX_BYTES}
              </span>
            </div>
            <Textarea
              id="edit-workspace-description"
              placeholder="What is this workspace for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={WORKSPACE_DESCRIPTION_MAX_CHARS}
              aria-invalid={isDescriptionTooLong}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isUpdating || isDescriptionTooLong}>
              {isUpdating && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
