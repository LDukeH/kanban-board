import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaces,
  createWorkspace,
  getWorkspaceMembers,
} from "@/lib/api/workspace.api";
import type { Workspace } from "@/types/workspace";

export function useWorkspaces() {
  const queryClient = useQueryClient();

  const {
    data: workspaces,
    isLoading,
    isError,
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

  return {
    workspaces: workspaces ?? [],
    isLoading,
    isError,
    createWorkspace: createWorkspaceMutation.mutateAsync,
    isCreating: createWorkspaceMutation.isPending,
  };
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "members"],
    queryFn: () => getWorkspaceMembers(workspaceId!),
    enabled: !!workspaceId,
  });
}
