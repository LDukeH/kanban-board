import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceMembers } from "@/hooks/useWorkspaces";
import type { WorkspaceRole } from "@/types/workspace";

/**
 * Derives the current user's Workspace role for a given Workspace.
 *
 * This is a UX/UI abstraction only. Authorization is still enforced by the
 * backend service layer; hidden UI is never a security mechanism.
 *
 * Reuses the existing `useAuth` (current user) and `useWorkspaceMembers`
 * (membership list) infrastructure rather than introducing a new
 * authorization system.
 */
export function useWorkspaceAccess(workspaceId: string | undefined) {
  const { user } = useAuth();
  const membersQuery = useWorkspaceMembers(workspaceId);

  const members = membersQuery.data ?? [];
  const membership = members.find((m) => m.userId === user?.id);

  const role: WorkspaceRole | undefined = membership?.role;
  const isLoadingRole =
    membersQuery.isLoading ||
    (!!workspaceId && !membersQuery.isSuccess && !membersQuery.isError);

  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isMember = role === "member";

  return {
    role,
    isLoadingRole,
    isOwner,
    isAdmin,
    isMember,
    /** Owner/Admin: manage Workspace members (invite, remove, change roles). */
    canManageMembers: isOwner || isAdmin,
    /** Owner/Admin: create/edit/delete Boards. */
    canManageBoards: isOwner || isAdmin,
    /** Owner/Admin: manage Workspace content (e.g. create/reorder Columns). */
    canManageWorkspaceContent: isOwner || isAdmin,
    /** Owner only: delete the Workspace. */
    canDeleteWorkspace: isOwner,
  };
}
