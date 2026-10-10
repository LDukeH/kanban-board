import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { useLeaveWorkspace } from "@/hooks/useWorkspaces";
import { describeMutationError, reportMutationError } from "@/lib/httpStatus";
import { LogOut, Loader2 } from "lucide-react";
import type { Workspace } from "@/types/workspace";

interface LeaveWorkspaceDialogProps {
  workspace: Workspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Invoked after the backend confirmed the user left the workspace. */
  onLeft?: () => void;
}

export function LeaveWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
  onLeft,
}: LeaveWorkspaceDialogProps) {
  const { leaveWorkspace, isLeaving } = useLeaveWorkspace(workspace.id);
  // A failed leave keeps the dialog open and reports inline so the user can
  // retry without re-navigating.
  const [error, setError] = useState<string | null>(null);
  // Synchronous lock so two rapid submits can never fire two leave requests
  // before React re-renders with the disabled confirm button.
  const submitLockedRef = useRef(false);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      submitLockedRef.current = false;
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockedRef.current || isLeaving) return;
    submitLockedRef.current = true;
    setError(null);
    try {
      await leaveWorkspace();
      onOpenChange(false);
      onLeft?.();
    } catch (err) {
      setError(
        describeMutationError(
          err,
          "Failed to leave the workspace. Please try again.",
        ),
      );
      reportMutationError("Leave workspace failed", err);
      submitLockedRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogTitle>Leave Workspace</DialogTitle>
        <DialogDescription>
          Are you sure you want to leave “{workspace.name}”? You will lose
          access to this workspace and its boards, and will need a new
          invitation to rejoin.
        </DialogDescription>

        <form onSubmit={handleConfirm} className="mt-4 flex flex-col gap-4">
          {error && <InlineAlert message={error} />}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isLeaving}>
              {isLeaving && <Loader2 className="size-4 animate-spin" />}
              <LogOut className="size-4" />
              Leave workspace
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
