import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBoards,
  createBoard,
  updateBoard,
  deleteBoard,
} from "@/lib/api/board.api";
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

  const updateBoardMutation = useMutation({
    mutationFn: ({
      boardId,
      data,
    }: {
      boardId: string;
      data: { name?: string; description?: string };
    }) => updateBoard(boardId, data),
    onSuccess: (updatedBoard) => {
      // Update the board in the workspace's board list
      queryClient.setQueryData<Board[]>(
        ["workspaces", workspaceId, "boards"],
        (old) =>
          old
            ? old.map((b) => (b.id === updatedBoard.id ? updatedBoard : b))
            : [updatedBoard],
      );
      // Update the single board cache as well
      queryClient.setQueryData<Board>(
        ["boards", updatedBoard.id],
        updatedBoard,
      );
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: (_data, deletedBoardId) => {
      // Remove the board from the workspace's board list
      queryClient.setQueryData<Board[]>(
        ["workspaces", workspaceId, "boards"],
        (old) => (old ? old.filter((b) => b.id !== deletedBoardId) : []),
      );
      // Remove the single board cache and its columns
      queryClient.removeQueries({ queryKey: ["boards", deletedBoardId] });
    },
  });

  return {
    boards: boards ?? [],
    isLoading,
    isError,
    error,
    createBoard: createBoardMutation.mutateAsync,
    isCreating: createBoardMutation.isPending,
    updateBoard: updateBoardMutation.mutateAsync,
    isUpdatingBoard: updateBoardMutation.isPending,
    deleteBoard: deleteBoardMutation.mutateAsync,
    isDeletingBoard: deleteBoardMutation.isPending,
  };
}
