import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBoards, createBoard } from "@/lib/api/board.api";
import type { Board } from "@/types/board";

export function useBoards(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const {
    data: boards,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["workspaces", workspaceId, "boards"],
    queryFn: () => getBoards(workspaceId!),
    enabled: !!workspaceId,
  });

  const createBoardMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      createBoard(workspaceId!, data),
    onSuccess: (newBoard) => {
      queryClient.setQueryData<Board[]>(
        ["workspaces", workspaceId, "boards"],
        (old) => (old ? [...old, newBoard] : [newBoard]),
      );
    },
  });

  return {
    boards: boards ?? [],
    isLoading,
    isError,
    error,
    createBoard: createBoardMutation.mutateAsync,
    isCreating: createBoardMutation.isPending,
  };
}
