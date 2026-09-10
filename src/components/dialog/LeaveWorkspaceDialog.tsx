import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { useLeaveWorkspace } from "@/hooks/useWorkspaces";
import { describeMutationError } from "@/lib/httpStatus";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import type { Workspace } from "@/types/workspace";

interface LeaveWorkspaceDialogProps {
  workspace: Workspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Invoked after the backend confirmed the user left the workspace. */
  onLeft?: () => void;
}

/**
 * Confirmation step before a member leaves a workspace
 * (`DELETE /workspaces/{workspaceID}/memberships`). The owner cannot leave
 * this way — the Leave button that opens this dialog is disabled for owners,
 * and the backend enforces it regardless. Success/error feedback is delivered
 * as toasts rather than an inline message inside the dialog.
 */
export function LeaveWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
  onLeft,
}: LeaveWorkspaceDialogProps) {
  const { leaveWorkspace, isLeaving } = useLeaveWorkspace(workspace.id);
  // Synchronous lock so two rapid submits can never fire two leave requests
  // before React re-renders with the disabled confirm button.
  const submitLockedRef = useRef(false);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      submitLockedRef.current = false;
    }
    onOpenChange(nextOpen);
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockedRef.current || isLeaving) return;
    submitLockedRef.current = true;
    try {
      await leaveWorkspace();
      onOpenChange(false);
      toast.success(`Left “${workspace.name}”`);
      onLeft?.();
    } catch (err) {
      toast.error(
        describeMutationError(
          err,
          "Failed to leave the workspace. Please try again.",
        ),
      );
      console.error("Leave workspace failed:", err);
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