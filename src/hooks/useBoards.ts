import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBoards,
  createBoard,
  updateBoard,
  deleteBoard,
} from "@/lib/api/board.api";
import type { Board } from "@/types/board";
import { useRecentStore } from "@/stores/recentStore";

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
      // Surface the new board at the top of the sidebar's Recent Boards,
      // the same way a visited board would be recorded.
      useRecentStore.getState().recordBoard({
        id: newBoard.id,
        name: newBoard.name,
        workspaceId: newBoard.workspaceId,
      });
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
      queryClient.setQueryData<Board[]>(
        ["workspaces", workspaceId, "boards"],
        (old) =>
          old
            ? old.map((b) => (b.id === updatedBoard.id ? updatedBoard : b))
            : [updatedBoard],
      );
      queryClient.setQueryData<Board>(
        ["boards", updatedBoard.id],
        updatedBoard,
      );
      // Refresh the board's name in the sidebar's Recent Boards (no-op if it
      // is not listed).
      useRecentStore.getState().renameBoard(updatedBoard.id, updatedBoard.name);
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: (_data, deletedBoardId) => {
      queryClient.setQueryData<Board[]>(
        ["workspaces", workspaceId, "boards"],
        (old) => (old ? old.filter((b) => b.id !== deletedBoardId) : []),
      );
      queryClient.removeQueries({ queryKey: ["boards", deletedBoardId] });
      useRecentStore.getState().forgetBoard(deletedBoardId);
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
