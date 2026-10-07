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
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useRecentStore } from "@/stores/recentStore";
import { describeMutationError, reportMutationError } from "@/lib/httpStatus";
import { cn } from "@/lib/utils";
import {
  WORKSPACE_DESCRIPTION_MAX_BYTES,
  WORKSPACE_DESCRIPTION_MAX_CHARS,
  descriptionByteLength,
  normalizeWorkspaceDescription,
  validateWorkspaceDescription,
} from "@/lib/validations/workspace.schema";

interface CreateWorkspaceDialogProps {
  trigger?: React.ReactElement;
}

export function CreateWorkspaceDialog({ trigger }: CreateWorkspaceDialogProps) {
  const { createWorkspace, isCreating } = useWorkspaces();
  const { recordWorkspace } = useRecentStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const descriptionBytes = descriptionByteLength(description);
  const isDescriptionTooLong = descriptionBytes > WORKSPACE_DESCRIPTION_MAX_BYTES;

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
      const created = await createWorkspace({
        name: name.trim(),
        // Always a string, never undefined: the backend stores "" for an empty
        // description and only skips the field when the key is absent.
        description: normalizeWorkspaceDescription(description),
      });
      // Surface the new workspace in the sidebar's Recent Workspaces right
      // away, without waiting for the user to open it.
      recordWorkspace({ id: created.id, name: created.name });
      setName("");
      setDescription("");
      setOpen(false);
    } catch (err) {
      setError(
        describeMutationError(
          err,
          "Failed to create workspace. Please try again.",
        ),
      );
      reportMutationError("Create workspace failed", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <Plus className="size-4" />
              Create Workspace
            </Button>
          )
        }
      />
      <DialogPopup>
        <DialogTitle>Create Workspace</DialogTitle>
        <DialogDescription>
          A workspace is a shared space for your team's boards.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              placeholder="e.g. University Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="workspace-description">Description (optional)</Label>
              {/* The limit is enforced in bytes, so multi-byte text can reach it
                  in fewer characters — the counter reports the real figure. */}
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
              id="workspace-description"
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
            <Button type="submit" disabled={isCreating || isDescriptionTooLong}>
              {isCreating && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
