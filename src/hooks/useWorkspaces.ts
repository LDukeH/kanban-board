import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  changeMemberRole,
  removeMember,
  leaveWorkspace,
  transferWorkspaceOwnership,
} from "@/lib/api/workspace.api";
import {
  cancelInvitation,
  acceptInvitation,
  createInvitation,
  declineInvitation,
  getWorkspaceInvitations,
} from "@/lib/api/invitation.api";
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

  // Both create and update return the full workspace, so the caches are written from the response instead of refetching; the list write is an upsert.
  const writeWorkspaceCaches = (workspace: Workspace) => {
    queryClient.setQueryData<Workspace>(
      ["workspaces", workspace.id],
      workspace,
    );
    queryClient.setQueryData<Workspace[]>(["workspaces"], (old) => {
      if (!old) return [workspace];
      const index = old.findIndex((w) => w.id === workspace.id);
      if (index === -1) return [...old, workspace];
      const next = [...old];
      next[index] = workspace;
      return next;
    });
  };

  const createWorkspaceMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: (newWorkspace) => {
      writeWorkspaceCaches(newWorkspace);
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: { name: string; description?: string };
    }) => updateWorkspace(workspaceId, data),
    onSuccess: (updatedWorkspace) => {
      writeWorkspaceCaches(updatedWorkspace);
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

/** Authoritative name/description for the detail page; the backend 403s non-members, so callers may pass `enabled: <known membership>`. */
export function useWorkspaceDetail(
  workspaceId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["workspaces", workspaceId],
    queryFn: () => getWorkspace(workspaceId!),
    enabled: !!workspaceId && options.enabled !== false,
  });
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "members"],
    queryFn: () => getWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
  });
}

/** Owner/Admin scoped: a pending invitee gets 403, so pass `enabled: canManageMembers` — a member may open the dialog but not list invitations. */
export function useWorkspaceInvitations(
  workspaceId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "invitations"],
    queryFn: () => getWorkspaceInvitations(workspaceId!),
    enabled: !!workspaceId && options.enabled !== false,
  });
}

export function useWorkspaceMemberActions(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidateMembers = () => {
    queryClient.invalidateQueries({
      queryKey: ["workspaces", workspaceId, "members"],
    });
  };

  const invalidateInvitations = () => {
    queryClient.invalidateQueries({
      queryKey: ["workspaces", workspaceId, "invitations"],
    });
  };

  // Inviting never creates a membership: the invitee becomes a member only after accepting, always as `member`.
  const createInvitationMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      createInvitation(workspaceId!, { userId }),
    onSuccess: invalidateInvitations,
  });

  // Cancelling only closes the pending invitation, so the members cache is
  // intentionally left untouched.
  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      cancelInvitation(workspaceId!, invitationId),
    onSuccess: invalidateInvitations,
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
    inviteMember: createInvitationMutation.mutateAsync,
    isInviting: createInvitationMutation.isPending,
    cancelInvitation: cancelInvitationMutation.mutateAsync,
    isCancellingInvitation: cancelInvitationMutation.isPending,
    changeRole: changeRoleMutation.mutateAsync,
    isChangingRole: changeRoleMutation.isPending,
    removeMember: removeMemberMutation.mutateAsync,
    isRemoving: removeMemberMutation.isPending,
  };
}

/** Invitee-side actions: separate from `useWorkspaceMemberActions` because an invitee has no workspace context until they accept; `workspaceId` only targets cache keys. */
export function useInvitationActions() {
  const queryClient = useQueryClient();

  const invalidateInvitationsFor = (workspaceId: string) => {
    queryClient.invalidateQueries({
      queryKey: ["workspaces", workspaceId, "invitations"],
    });
  };

  // Acceptance creates the membership in the same transaction, so the workspace list, members list and workspace-scoped invitations all change.
  const acceptInvitationMutation = useMutation({
    mutationFn: ({ invitationId }: { invitationId: string; workspaceId: string }) =>
      acceptInvitation(invitationId),
    onSuccess: (_invitation, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "members"],
      });
      invalidateInvitationsFor(workspaceId);
    },
  });

  // Declining grants no access and creates no membership, so the workspace list is left untouched.
  const declineInvitationMutation = useMutation({
    mutationFn: ({ invitationId }: { invitationId: string; workspaceId: string }) =>
      declineInvitation(invitationId),
    onSuccess: (_invitation, { workspaceId }) => {
      invalidateInvitationsFor(workspaceId);
    },
  });

  return {
    acceptInvitation: acceptInvitationMutation.mutateAsync,
    isAccepting: acceptInvitationMutation.isPending,
    declineInvitation: declineInvitationMutation.mutateAsync,
    isDeclining: declineInvitationMutation.isPending,
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
