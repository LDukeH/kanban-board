import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
} from "@/lib/api/workspace.api";
import type { Workspace } from "@/types/workspace";

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
