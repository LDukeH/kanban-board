import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { InviteWorkspaceMembersDialog } from "@/components/dialog/InviteWorkspaceMembersDialog";
import {
  useWorkspaceMembers,
  useWorkspaceMemberActions,
} from "@/hooks/useWorkspaces";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { describeLoadError } from "@/lib/httpStatus";
import {
  Loader2,
  Info,
  UserPlus,
  Users,
  UserMinus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { WorkspaceMember, WorkspaceRole } from "@/types/workspace";
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
  /** Controlled open state (optional). */
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
  onRemove,
  isRemoving,
  onChangeRole,
  isRoleChanging,
  isSoleOwner,
}: {
  member: WorkspaceMember;
  isCurrentUser: boolean;
  canRemove: boolean;
  onRemove: (member: WorkspaceMember) => void;
  isRemoving: boolean;
  onChangeRole: (member: WorkspaceMember, role: WorkspaceRole) => void;
  isRoleChanging: boolean;
  isSoleOwner: boolean;
}) {
  const isOwner = member.role === "owner";
  const isAdmin = member.role === "admin";

  // The action shown for the current user's own row: leave the workspace,
  // disabled (and relabelled) when they are the owner.
  const ownActionDisabled = isOwner;
  const ownActionLabel = isOwner ? "Remove from Workspace" : "Leave";

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
          onClick={() => onRemove(member)}
        >
          <UserMinus className="size-3.5" />
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

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen : setInternalOpen;

  const { user } = useAuth();
  const { canManageMembers } = useWorkspaceAccess(workspaceId);
  const membersQuery = useWorkspaceMembers(workspaceId);
  const { removeMember, isRemoving, changeRole } =
    useWorkspaceMemberActions(workspaceId);

  const members = membersQuery.data ?? [];
  const ownerCount = members.filter((m) => m.role === "owner").length;

  function handleRemove(member: WorkspaceMember) {
    // Remove self (leave) or remove another member; the backend authorizes.
    void removeMember(member.id).catch(() => undefined);
  }

  function handleChangeRole(member: WorkspaceMember, role: WorkspaceRole) {
    // Owners are outside the member ↔ admin toggle entirely, so they can
    // never be demoted (the sole owner is additionally protected from
    // removal). The backend authorizes regardless.
    if (member.role === "owner") return;
    setChangingRoleId(member.id);
    void changeRole({ membershipId: member.id, role })
      .catch((err) => console.error("Role change failed:", err))
      .finally(() => setChangingRoleId(null));
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
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
                    onRemove={handleRemove}
                    isRemoving={isRemoving}
                    onChangeRole={handleChangeRole}
                    isRoleChanging={changingRoleId === member.id}
                    isSoleOwner={member.role === "owner" && ownerCount === 1}
                  />
                ))}
              </ul>
            )}
          </div>
        </DialogPopup>
      </Dialog>

      {inviteOpen && (
        <InviteWorkspaceMembersDialog
          workspaceId={workspaceId}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}
    </>
  );
}
