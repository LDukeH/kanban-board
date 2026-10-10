import { useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { InviteWorkspaceMembersDialog } from "@/components/dialog/InviteWorkspaceMembersDialog";
import { TransferWorkspaceOwnershipDialog } from "@/components/dialog/TransferWorkspaceOwnershipDialog";
import { LeaveWorkspaceDialog } from "@/components/dialog/LeaveWorkspaceDialog";
import {
  useWorkspaces,
  useWorkspaceInvitations,
  useWorkspaceMembers,
  useWorkspaceMemberActions,
} from "@/hooks/useWorkspaces";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { describeLoadError, describeMutationError, reportMutationError } from "@/lib/httpStatus";
import { formatRelativeTime } from "@/lib/relativeTime";
import {
  Loader2,
  Info,
  UserPlus,
  Users,
  UserMinus,
  ArrowUp,
  ArrowDown,
  Crown,
  LogOut,
  X,
} from "lucide-react";
import type {
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types/workspace";
import {
  roleLabel,
  emailInitial,
  emailToHandle,
  avatarGradient,
} from "@/lib/memberDisplay";

interface WorkspaceMembersDialogProps {
  workspaceId: string;
  /** Optional pre-rendered trigger. Defaults to a "Members" button. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ROLE_BADGE_CLASSES: Record<WorkspaceRole, string> = {
  owner: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  admin: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  member: "bg-muted text-muted-foreground",
};

function MemberRow({
  member,
  isCurrentUser,
  canRemove,
  onLeave,
  onRemove,
  isRemoving,
  onChangeRole,
  isRoleChanging,
  isSoleOwner,
}: {
  member: WorkspaceMember;
  isCurrentUser: boolean;
  canRemove: boolean;
  onLeave: (member: WorkspaceMember) => void;
  onRemove: (member: WorkspaceMember) => void;
  isRemoving: boolean;
  onChangeRole: (member: WorkspaceMember, role: WorkspaceRole) => void;
  isRoleChanging: boolean;
  isSoleOwner: boolean;
}) {
  const isOwner = member.role === "owner";
  const isAdmin = member.role === "admin";

  // The action shown for the current user's own row: leave the workspace.
  // Owners cannot use it — they must transfer ownership first (see the
  // pinned "Transfer ownership" action) or delete the workspace. The backend
  // enforces the same restriction.
  const ownActionDisabled = isOwner;
  const ownActionLabel = "Leave";
  const ownActionTitle = isOwner
    ? "Owners cannot leave. Transfer ownership first."
    : undefined;

  // Owner/Admin can promote/demote other non-owner members and remove anyone —
  // except the sole owner, who can never be removed or re-roled.
  const busy = isRoleChanging || isRemoving;
  const showOwnAction = isCurrentUser;
  const showRoleAction = !isCurrentUser && canRemove && !isOwner && !isSoleOwner;
  const showManagedRemove = !isCurrentUser && canRemove && !isSoleOwner;
  const nextRole: WorkspaceRole = isAdmin ? "member" : "admin";
  const roleActionLabel = isAdmin ? "Demote" : "Promote";

  return (
    <li className="flex items-center gap-4 py-3">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-semibold text-white",
          avatarGradient(member.userId || member.email),
        )}
      >
        {emailInitial(member.email)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {member.email}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {emailToHandle(member.email)}
        </p>
      </div>

      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          ROLE_BADGE_CLASSES[member.role],
        )}
      >
        <Info className="size-3" />
        {roleLabel(member.role)}
      </span>

      {showOwnAction && (
        <Button
          size="sm"
          variant={ownActionDisabled ? "secondary" : "outline"}
          disabled={ownActionDisabled}
          onClick={() => onLeave(member)}
          title={ownActionTitle}
        >
          <LogOut className="size-3.5" />
          {ownActionLabel}
        </Button>
      )}

      {showRoleAction && (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onChangeRole(member, nextRole)}
          title={`${roleActionLabel} ${member.email}`}
        >
          {isRoleChanging ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isAdmin ? (
            <ArrowDown className="size-3.5" />
          ) : (
            <ArrowUp className="size-3.5" />
          )}
          {roleActionLabel}
        </Button>
      )}

      {showManagedRemove && (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={busy}
          onClick={() => onRemove(member)}
        >
          <UserMinus className="size-3.5" />
          Remove
        </Button>
      )}
    </li>
  );
}
export function WorkspaceMembersDialog({
  workspaceId,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: WorkspaceMembersDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  // Row actions (remove / cancel invitation / change role) have no per-row
  // error surface, so a failure is reported once for the whole dialog.
  const [actionError, setActionError] = useState<string | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen : setInternalOpen;

  const { user } = useAuth();
  const { canManageMembers, isOwner } = useWorkspaceAccess(workspaceId);
  const navigate = useNavigate();
  const { workspaces } = useWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setActionError(null);
    }
    setOpen?.(nextOpen);
  }
  const membersQuery = useWorkspaceMembers(workspaceId);
  const invitationsQuery = useWorkspaceInvitations(workspaceId, {
    enabled: canManageMembers,
  });
  const { removeMember, changeRole, cancelInvitation } =
    useWorkspaceMemberActions(workspaceId);

  const members = membersQuery.data ?? [];
  const ownerCount = members.filter((m) => m.role === "owner").length;
  // The live backend returns invitations in every status; only pending ones
  // are actionable (accepted ones are already members, and only a pending
  // invitation may be cancelled — source-of-truth §3.4).
  const pendingInvitations = (invitationsQuery.data ?? []).filter(
    (invitation) => invitation.status === "pending",
  );

  function handleRemove(member: WorkspaceMember) {
    if (removingId) return;
    setRemovingId(member.id);
    // The row disappearing from the list is the success feedback; only the
    // failure needs a message, and it is reported for the whole dialog.
    void removeMember(member.id)
      .catch((err) => {
        setActionError(
          describeMutationError(
            err,
            `Could not remove ${emailToHandle(member.email)}. Please try again.`,
          ),
        );
        reportMutationError("Remove member failed", err);
      })
      .finally(() => setRemovingId(null));
  }

  function handleLeave() {
    setLeaveOpen(true);
  }

  function handleCancelInvitation(invitation: WorkspaceInvitation) {
    if (cancellingId) return;
    setCancellingId(invitation.id);
    const label = invitation.inviteeEmail ?? invitation.inviteeUserId;
    void cancelInvitation(invitation.id)
      .catch((err) => {
        setActionError(
          describeMutationError(
            err,
            `Could not cancel the invitation for ${label}. Please try again.`,
          ),
        );
        reportMutationError("Cancel invitation failed", err);
      })
      .finally(() => setCancellingId(null));
  }

  function handleChangeRole(member: WorkspaceMember, role: WorkspaceRole) {
    if (member.role === "owner") return;
    if (changingRoleId) return;
    setChangingRoleId(member.id);
    // The updated role badge on the row is the success feedback; only failures
    // need a message.
    void changeRole({ membershipId: member.id, role })
      .catch((err) => {
        setActionError(
          describeMutationError(
            err,
            `Could not change ${emailToHandle(member.email)}'s role. Please try again.`,
          ),
        );
        reportMutationError("Change role failed", err);
      })
      .finally(() => setChangingRoleId(null));
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger render={trigger} />}
        <DialogPopup className="max-w-2xl">
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2">
              Contributors
            </DialogTitle>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
              {membersQuery.isLoading ? "…" : members.length}
            </span>
          </div>
          <DialogDescription className="mt-1">
            People who have access to this workspace.
          </DialogDescription>

          {actionError && (
            <InlineAlert
              message={actionError}
              onDismiss={() => setActionError(null)}
              className="mt-3"
            />
          )}

          <div className="mt-4 flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-foreground">Members</h3>
            {canManageMembers && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-4" />
                Invite Workspace Members
              </Button>
            )}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {membersQuery.isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : membersQuery.isError ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <p>{describeLoadError(membersQuery.error)}</p>
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No members yet. Invite people to collaborate.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isCurrentUser={member.userId === user?.id}
                    canRemove={canManageMembers}
                    onLeave={handleLeave}
                    onRemove={handleRemove}
                    isRemoving={removingId === member.id}
                    onChangeRole={handleChangeRole}
                    isRoleChanging={changingRoleId === member.id}
                    isSoleOwner={member.role === "owner" && ownerCount === 1}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Pending invitations are a separate concept from members: the
              invitee has no access until they accept, so they are never mixed
              into the member list (source-of-truth §3.4). */}
          {canManageMembers && pendingInvitations.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Pending invitations
                </h3>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
                  {pendingInvitations.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Invited users join as members only after they accept.
              </p>
              <ul className="mt-2 divide-y divide-border">
                {pendingInvitations.map((invitation) => {
                  const label =
                    invitation.inviteeEmail ?? invitation.inviteeUserId;
                  const isCancelling = cancellingId === invitation.id;
                  return (
                    <li
                      key={invitation.id}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-xs font-semibold text-white",
                          avatarGradient(invitation.inviteeUserId),
                        )}
                      >
                        {emailInitial(label)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Invited {formatRelativeTime(invitation.createdAt)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={isCancelling}
                        onClick={() => handleCancelInvitation(invitation)}
                      >
                        {isCancelling ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <X className="size-3.5" />
                        )}
                        Cancel
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Owner-only transfer action, pinned below the scrollable member
              list so it stays visible no matter how many members there are. */}
          {isOwner && (
            <div className="mt-4 border-t border-border pt-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setTransferOpen(true)}
              >
                <Crown className="size-4" />
                Transfer ownership
              </Button>
            </div>
          )}
        </DialogPopup>
      </Dialog>

      {inviteOpen && (
        <InviteWorkspaceMembersDialog
          workspaceId={workspaceId}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}

      {transferOpen && (
        <TransferWorkspaceOwnershipDialog
          workspaceId={workspaceId}
          open={transferOpen}
          onOpenChange={setTransferOpen}
          onSuccess={() => setTransferOpen(false)}
        />
      )}

      {leaveOpen && workspace && (
        <LeaveWorkspaceDialog
          workspace={workspace}
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          onLeft={() => navigate("/workspaces")}
        />
      )}
    </>
  );
}
