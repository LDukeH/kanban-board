import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  createMembership,
  changeMemberRole,
  removeMember,
  leaveWorkspace,
  transferWorkspaceOwnership,
} from "@/lib/api/workspace.api";
import { searchUsersByEmail } from "@/lib/api/users.api";
import type { Workspace, WorkspaceRole } from "@/types/workspace";
import { useRecentStore } from "@/stores/recentStore";

export function useWorkspaces() {
  const queryClient = useQueryClient();

  const {
    data: workspaces,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getWorkspaces,
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: (newWorkspace) => {
      queryClient.setQueryData<Workspace[]>(["workspaces"], (old) =>
        old ? [...old, newWorkspace] : [newWorkspace],
      );
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: { name?: string; description?: string };
    }) => updateWorkspace(workspaceId, data),
    onSuccess: (updatedWorkspace) => {
      queryClient.setQueryData<Workspace[]>(["workspaces"], (old) =>
        old
          ? old.map((w) =>
              w.id === updatedWorkspace.id ? updatedWorkspace : w,
            )
          : [updatedWorkspace],
      );
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: string) => deleteWorkspace(workspaceId),
    onSuccess: (_data, deletedWorkspaceId) => {
      queryClient.setQueryData<Workspace[]>(["workspaces"], (old) =>
        old ? old.filter((w) => w.id !== deletedWorkspaceId) : [],
      );
      // Invalidate members query for the deleted workspace
      queryClient.removeQueries({
        queryKey: ["workspaces", deletedWorkspaceId],
      });
      // Drop the workspace (and its boards) from the recent sidebar list
      useRecentStore.getState().forgetWorkspace(deletedWorkspaceId);
    },
  });

  return {
    workspaces: workspaces ?? [],
    isLoading,
    isError,
    error,
    createWorkspace: createWorkspaceMutation.mutateAsync,
    isCreating: createWorkspaceMutation.isPending,
    updateWorkspace: updateWorkspaceMutation.mutateAsync,
    isUpdating: updateWorkspaceMutation.isPending,
    deleteWorkspace: deleteWorkspaceMutation.mutateAsync,
    isDeleting: deleteWorkspaceMutation.isPending,
  };
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "members"],
    queryFn: () => getWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
  });
}

/**
 * Mutations that add, re-role, or remove members of a Workspace.
 * Each success invalidates the member list query for the Workspace so
 * dependent components (dialog list, access flags) stay in sync.
 */
export function useWorkspaceMemberActions(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidateMembers = () => {
    queryClient.invalidateQueries({
      queryKey: ["workspaces", workspaceId, "members"],
    });
  };

  const createMembershipMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: WorkspaceRole }) =>
      createMembership(workspaceId!, { email, role }),
    onSuccess: invalidateMembers,
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({
      membershipId,
      role,
    }: {
      membershipId: string;
      role: WorkspaceRole;
    }) => changeMemberRole(workspaceId!, membershipId, role),
    onSuccess: invalidateMembers,
  });

  const removeMemberMutation = useMutation({
    mutationFn: (membershipId: string) =>
      removeMember(workspaceId!, membershipId),
    onSuccess: invalidateMembers,
  });

  return {
    /** Add a single member by email. */
    addMember: createMembershipMutation.mutateAsync,
    isAdding: createMembershipMutation.isPending,
    /** Change a member's role. */
    changeRole: changeRoleMutation.mutateAsync,
    isChangingRole: changeRoleMutation.isPending,
    /** Remove a member by membership id. */
    removeMember: removeMemberMutation.mutateAsync,
    isRemoving: removeMemberMutation.isPending,
  };
}

/**
 * Remove the current user from a Workspace via the dedicated
 * `DELETE /workspaces/{workspaceID}/memberships` endpoint. Unlike removing
 * another member, the owner cannot leave this way — the backend blocks it (the
 * UI additionally disables the Leave action for owners).
 *
 * On success the workspace list is invalidated (the left workspace disappears
 * from the dashboard), all cached queries for the workspace are dropped, and
 * the recent sidebar entry is forgotten.
 */
export function useLeaveWorkspace(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const leaveWorkspaceMutation = useMutation({
    mutationFn: () => leaveWorkspace(workspaceId!),
    onSuccess: () => {
      // The workspace is no longer in this user's list; refetch it.
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      // Drop cached members/boards/columns/tasks for the left workspace.
      queryClient.removeQueries({ queryKey: ["workspaces", workspaceId] });
      // Drop the workspace (and its boards) from the recent sidebar list.
      useRecentStore.getState().forgetWorkspace(workspaceId!);
    },
  });

  return {
    /** Leave the workspace (removes the current user's membership). */
    leaveWorkspace: leaveWorkspaceMutation.mutateAsync,
    isLeaving: leaveWorkspaceMutation.isPending,
  };
}

/**
 * Transfer workspace ownership to another member of the Workspace.
 *
 * The backend performs the demote/promote atomically in one request. On success
 * the workspace list and the member list are invalidated so the UI immediately
 * reflects the new owner/member roles (no optimistic role changes before the
 * request returns).
 */
export function useTransferWorkspaceOwnership(
  workspaceId: string | undefined,
) {
  const queryClient = useQueryClient();

  const transferOwnershipMutation = useMutation({
    mutationFn: (newOwnerId: string) =>
      transferWorkspaceOwnership(workspaceId!, newOwnerId),
    onSuccess: () => {
      // Refresh the workspace summary list, the current user's membership info
      // (members query drives useWorkspaceAccess), and the workspace's members
      // so the new owner badge and demoted current-user role appear.
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "members"],
      });
    },
  });

  return {
    /** Transfer ownership to another member by user id. */
    transferOwnership: transferOwnershipMutation.mutateAsync,
    isTransferring: transferOwnershipMutation.isPending,
  };
}

/**
 * Debounce search-by-email against `GET /users/search`. Only runs once the
 * query has at least 2 characters, mirroring how backend search is debounced
 * at the UI layer without issuing requests for empty/too-short input.
 */
export function useSearchUsers(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["users", "search", trimmed],
    queryFn: () => searchUsersByEmail(trimmed),
    enabled: trimmed.length >= 2,
  });
}
