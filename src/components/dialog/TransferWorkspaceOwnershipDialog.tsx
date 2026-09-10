import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, Crown, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "react-toastify";
import {
  useWorkspaceMembers,
  useTransferWorkspaceOwnership,
} from "@/hooks/useWorkspaces";
import { describeMutationError } from "@/lib/httpStatus";
import { cn } from "@/lib/utils";
import {
  emailInitial,
  emailToHandle,
  avatarGradient,
} from "@/lib/memberDisplay";
import type { WorkspaceMember } from "@/types/workspace";

interface TransferWorkspaceOwnershipDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (member: WorkspaceMember) => void;
}

/**
 * Transfer ownership of the workspace to another member.
 */
export function TransferWorkspaceOwnershipDialog({
  workspaceId,
  open,
  onOpenChange,
  onSuccess,
}: TransferWorkspaceOwnershipDialogProps) {
  const { user } = useAuth();
  const membersQuery = useWorkspaceMembers(workspaceId);
  const { transferOwnership, isTransferring } =
    useTransferWorkspaceOwnership(workspaceId);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // Synchronous lock so two rapid clicks can never fire two transfer requests
  // before React re-renders with the disabled button.
  const submitLockedRef = useRef(false);

  const members = membersQuery.data ?? [];
  // Candidates: real members of the workspace, excluding the current owner.
  const candidates = members.filter(
    (m) => m.userId !== user?.id && m.role !== "owner",
  );
  const selectedMember =
    candidates.find((m) => m.userId === selectedUserId) ?? null;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Reset the selection each time the dialog opens.
      setSelectedUserId(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMember) return;
    if (submitLockedRef.current || isTransferring) return;
    submitLockedRef.current = true;
    try {
      await transferOwnership(selectedMember.userId);
      // 204 only — queries were invalidated by the hook on success.
      onSuccess?.(selectedMember);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        describeMutationError(
          err,
          "Failed to transfer ownership. Please try again.",
        ),
      );
      console.error("Transfer ownership failed:", err);
    } finally {
      submitLockedRef.current = false;
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogTitle>Transfer Ownership</DialogTitle>
        <DialogDescription>
          Choose the member who will become the new owner of this workspace.
        </DialogDescription>

        <div className="mt-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
              <span className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-sm transition-colors hover:bg-muted">
                {membersQuery.isLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading members…
                  </span>
                ) : selectedMember ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-semibold text-white",
                        avatarGradient(
                          selectedMember.userId || selectedMember.email,
                        ),
                      )}
                    >
                      {emailInitial(selectedMember.email)}
                    </span>
                    <span className="truncate text-foreground">
                      {selectedMember.email}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Select a member…
                  </span>
                )}
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {membersQuery.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  No other members available to transfer ownership to.
                </p>
              ) : (
                candidates.map((member) => {
                  const isSelected = member.userId === selectedUserId;
                  return (
                    <DropdownMenuItem
                      key={member.userId}
                      onClick={() => setSelectedUserId(member.userId)}
                      className="gap-2"
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white",
                          avatarGradient(member.userId || member.email),
                        )}
                      >
                        {emailInitial(member.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {member.email}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {emailToHandle(member.email)}
                        </span>
                      </span>
                      {isSelected && (
                        <Check className="size-3.5 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedMember && (
            <p className="mt-4 text-sm text-muted-foreground">
              Transfer workspace ownership to{" "}
              <span className="font-semibold text-foreground">
                {selectedMember.email}
              </span>
              ? They will become the new owner of this workspace and you will
              become a member.{" "}
              <span className="font-semibold text-foreground">
                You will no longer be the workspace owner after this action.
              </span>
            </p>
          )}
        </div>

        <form onSubmit={handleConfirm} className="mt-4 flex flex-col gap-4">
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={!selectedMember || isTransferring}
            >
              {isTransferring ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Crown className="size-4" />
              )}
              Transfer ownership
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
