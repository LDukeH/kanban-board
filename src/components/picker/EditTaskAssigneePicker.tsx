import { useState } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useAuth } from "@/hooks/useAuth";
import { useTaskAssignees } from "@/hooks/useTaskAssignees";
import { useWorkspaceMembers } from "@/hooks/useWorkspaces";
import { describeMutationError, reportMutationError } from "@/lib/httpStatus";
import { cn } from "@/lib/utils";
import {
  emailInitial,
  emailToHandle,
  avatarGradient,
} from "@/lib/memberDisplay";

interface EditTaskAssigneePickerProps {
  taskId: string;
  workspaceId: string;
  boardId: string;
  columnId: string;
  /** Optional controlled open state (e.g. opened from the modal's Add menu). */
  open?: boolean;
  /** Receives open-state changes when `open` is controlled or for read-only sync. */
  onOpenChange?: (open: boolean) => void;
}

/** Assignee picker popup with member search; a user may only unassign themself, which the server also enforces. */
export function EditTaskAssigneePicker({
  taskId,
  workspaceId,
  boardId,
  columnId,
  open,
  onOpenChange,
}: EditTaskAssigneePickerProps) {
  const { user } = useAuth();
  const {
    assignees,
    isLoadingAssignees,
    assignUser,
    unassignUser,
  } = useTaskAssignees(taskId, { boardId, columnId });
  const membersQuery = useWorkspaceMembers(workspaceId);

  const [search, setSearch] = useState("");
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  // Assign/unassign failures report inside the popup (which stays open on
  // failure) so the member rows keep their context.
  const [error, setError] = useState<string | null>(null);

  const members = membersQuery.data ?? [];
  const isLoadingMembers =
    membersQuery.isLoading ||
    (!!workspaceId && !membersQuery.isSuccess && !membersQuery.isError);

  const needSearch = members.length > 8;
  const query = search.trim().toLowerCase();
  const filteredMembers = query
    ? members.filter(
        (m) =>
          m.email.toLowerCase().includes(query) ||
          emailToHandle(m.email).toLowerCase().includes(query),
      )
    : members;

  const assignedUserIds = new Set(assignees.map((a) => a.user_id));
  const currentUserId = user?.id;

  async function handleToggle(memberUserId: string) {
    if (togglingUserId) return;
    const isAssigned = assignedUserIds.has(memberUserId);
    const isSelf = memberUserId === currentUserId;
    if (isAssigned && !isSelf) return;

    setTogglingUserId(memberUserId);
    setError(null);
    try {
      if (isAssigned) {
        await unassignUser({ userId: memberUserId });
      } else {
        await assignUser({ userId: memberUserId });
      }
    } catch (err) {
      setError(
        describeMutationError(
          err,
          isAssigned
            ? "Could not unassign this member. Please try again."
            : "Could not assign this member. Please try again.",
        ),
      );
      reportMutationError("Assignee toggle failed", err);
    } finally {
      setTogglingUserId(null);
    }
  }
return (
    <DropdownMenu
      {...(open !== undefined ? { open } : {})}
      onOpenChange={(nextOpen) => {
        onOpenChange?.(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <DropdownMenuTrigger>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted">
          Assignees
          {assignees.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">
              {assignees.length}
            </span>
          )}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {needSearch && (
          <div className="relative px-1 pb-1 pt-1.5">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-7"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {isLoadingMembers || isLoadingAssignees ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            {members.length === 0
              ? "No members in this workspace yet."
              : query
                ? "No members match your search."
                : "No assignable members."}
          </p>
        ) : (
          filteredMembers.map((member) => {
            const isAssigned = assignedUserIds.has(member.userId);
            const isSelf = member.userId === currentUserId;
            const removable = isSelf && isAssigned;
            const isBusy = togglingUserId === member.userId;
            return (
              <DropdownMenuItem
                key={member.userId}
                disabled={isAssigned && !isSelf}
                onClick={() => handleToggle(member.userId)}
                closeOnClick={false}
                className="gap-2"
                title={
                  isAssigned && !isSelf
                    ? "You can only unassign yourself."
                    : undefined
                }
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
                  <span className="block truncate text-sm">{member.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {isSelf ? "You · " : ""}
                    {emailToHandle(member.email)}
                  </span>
                </span>
                {isBusy ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : isAssigned ? (
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      removable ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                ) : (
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                )}
              </DropdownMenuItem>
            );
          })
        )}
        {error && (
          <div className="border-t border-border p-1.5 pt-2">
            <InlineAlert message={error} onDismiss={() => setError(null)} />
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}