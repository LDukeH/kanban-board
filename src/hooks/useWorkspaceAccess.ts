import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceMembers } from "@/hooks/useWorkspaces";
import type { WorkspaceRole } from "@/types/workspace";

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
    canManageMembers: isOwner || isAdmin,
    canManageWorkspace: isOwner || isAdmin,
    canManageBoards: isOwner || isAdmin,
    canManageWorkspaceContent: isOwner || isAdmin,
    canManageLabels: isOwner || isAdmin,

    canWorkOnTasks: isOwner || isAdmin || isMember,
    canAssignLabels: isOwner || isAdmin || isMember,
    canDeleteTask: isOwner || isAdmin,
    canDeleteWorkspace: isOwner,
  };
}
