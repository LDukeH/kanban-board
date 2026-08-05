import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBoard } from "@/lib/api/board.api";
import {
  getBoardColumns,
  createColumn,
  updateColumn,
  updateColumnPosition,
  deleteColumn,
} from "@/lib/api/column.api";
import type { Column } from "@/types/board";

export function useBoard(boardId: string | undefined) {
  const queryClient = useQueryClient();

  const boardQuery = useQuery({
    queryKey: ["boards", boardId],
    queryFn: () => {
      return getBoard(boardId!);
    },
    enabled: !!boardId,
  });

  const columnsQuery = useQuery({
    queryKey: ["boards", boardId, "columns"],
    queryFn: () => {
      return getBoardColumns(boardId!);
    },
    enabled: !!boardId,
  });

  const createColumnMutation = useMutation({
    mutationFn: (data: { name: string }) => createColumn(boardId!, data),
    onSuccess: (newColumn) => {
      queryClient.setQueryData<Column[]>(
        ["boards", boardId, "columns"],
        (old) => (old ? [...old, newColumn] : [newColumn]),
      );
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: ({
      columnId,
      data,
    }: {
      columnId: string;
      data: { name?: string };
    }) => updateColumn(columnId, data),
    onSuccess: (updatedColumn) => {
      queryClient.setQueryData<Column[]>(
        ["boards", boardId, "columns"],
        (old) =>
          old
            ? old.map((c) => (c.id === updatedColumn.id ? updatedColumn : c))
            : [updatedColumn],
      );
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) => deleteColumn(columnId),
    onSuccess: (_data, deletedColumnId) => {
      queryClient.setQueryData<Column[]>(
        ["boards", boardId, "columns"],
        (old) => (old ? old.filter((c) => c.id !== deletedColumnId) : []),
      );
    },
  });

  const updateColumnPositionMutation = useMutation({
    mutationFn: ({
      columnId,
      position,
    }: {
      columnId: string;
      position: number;
    }) => updateColumnPosition(columnId, position),
    onMutate: async ({ columnId, position }) => {
      await queryClient.cancelQueries({
        queryKey: ["boards", boardId, "columns"],
      });

      const previousColumns =
        queryClient.getQueryData<Column[]>(["boards", boardId, "columns"]) ??
        [];

      queryClient.setQueryData<Column[]>(
        ["boards", boardId, "columns"],
        (old) => {
          if (!old) return old;
          const sorted = [...old].sort((a, b) => a.position - b.position);
          const moving = sorted.find((c) => c.id === columnId);
          if (!moving) return old;

          const withoutMoving = sorted.filter((c) => c.id !== columnId);
          const nextIndex = Math.min(position, withoutMoving.length);
          withoutMoving.splice(nextIndex, 0, moving);

          return withoutMoving.map((c, index) => ({
            ...c,
            position: index,
          }));
        },
      );

      return { previousColumns };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousColumns) {
        queryClient.setQueryData<Column[]>(
          ["boards", boardId, "columns"],
          context.previousColumns,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["boards", boardId, "columns"],
      });
    },
  });

  return {
    board: boardQuery.data,
    isLoadingBoard: boardQuery.isLoading,
    isBoardError: boardQuery.isError,
    boardError: boardQuery.error,
    columns: columnsQuery.data ?? [],
    isLoadingColumns: columnsQuery.isLoading,
    isColumnsError: columnsQuery.isError,
    columnsError: columnsQuery.error,
    createColumn: createColumnMutation.mutateAsync,
    isCreatingColumn: createColumnMutation.isPending,
    updateColumn: updateColumnMutation.mutateAsync,
    isUpdatingColumn: updateColumnMutation.isPending,
    deleteColumn: deleteColumnMutation.mutateAsync,
    isDeletingColumn: deleteColumnMutation.isPending,
    updateColumnPosition: updateColumnPositionMutation.mutateAsync,
    isUpdatingColumnPosition: updateColumnPositionMutation.isPending,
  };
}
