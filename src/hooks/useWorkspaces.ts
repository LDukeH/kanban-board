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
      // Refresh the workspace's name in the sidebar's Recent Workspaces
      // (no-op if it is not listed).
      useRecentStore
        .getState()
        .renameWorkspace(updatedWorkspace.id, updatedWorkspace.name);
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: string) => deleteWorkspace(workspaceId),
    onSuccess: (_data, deletedWorkspaceId) => {
      queryClient.setQueryData<Workspace[]>(["workspaces"], (old) =>
        old ? old.filter((w) => w.id !== deletedWorkspaceId) : [],
      );
      queryClient.removeQueries({
        queryKey: ["workspaces", deletedWorkspaceId],
      });
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
    addMember: createMembershipMutation.mutateAsync,
    isAdding: createMembershipMutation.isPending,
    changeRole: changeRoleMutation.mutateAsync,
    isChangingRole: changeRoleMutation.isPending,
    removeMember: removeMemberMutation.mutateAsync,
    isRemoving: removeMemberMutation.isPending,
  };
}

export function useLeaveWorkspace(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const leaveWorkspaceMutation = useMutation({
    mutationFn: () => leaveWorkspace(workspaceId!),
    onSuccess: () => {
      // The workspace is no longer in this user's list; refetch it.
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      // Drop cached members/boards/columns/tasks for the left workspace.
      queryClient.removeQueries({ queryKey: ["workspaces", workspaceId] });
      useRecentStore.getState().forgetWorkspace(workspaceId!);
    },
  });

  return {
    leaveWorkspace: leaveWorkspaceMutation.mutateAsync,
    isLeaving: leaveWorkspaceMutation.isPending,
  };
}

export function useTransferWorkspaceOwnership(workspaceId: string | undefined) {
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
    transferOwnership: transferOwnershipMutation.mutateAsync,
    isTransferring: transferOwnershipMutation.isPending,
  };
}

export function useSearchUsers(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["users", "search", trimmed],
    queryFn: () => searchUsersByEmail(trimmed),
    enabled: trimmed.length >= 2,
  });
}
