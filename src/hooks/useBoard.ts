import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBoard } from "@/lib/api/board.api";
import {
  getBoardColumns,
  createColumn,
  updateColumn,
  updateColumnPosition,
  deleteColumn,
} from "@/lib/api/column.api";
import {
  getBoardLabels,
  createLabel,
  updateLabel,
  deleteLabel,
} from "@/lib/api/label.api";
import { reorderColumns } from "@/lib/dragDrop";
import { isStaleError } from "@/lib/httpStatus";
import type { Column, Label, Task } from "@/types/board";

export function boardLabelsQueryKey(
  boardId: string,
): readonly ["boards", string, "labels"] {
  return ["boards", boardId, "labels"];
}

const boardMoveGatePromises = new Map<string, Promise<void>>();
const boardMovePredecessors = new Map<string, Promise<void>>();

function createColumnMoveGate() {
  let release!: () => void;
  const settled = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { settled, release };
}

export function useBoard(boardId: string | undefined) {
  const queryClient = useQueryClient();

  const boardQuery = useQuery({
    queryKey: ["boards", boardId],
    queryFn: () => getBoard(boardId!),
    enabled: !!boardId,
  });

  const columnsQuery = useQuery({
    queryKey: ["boards", boardId, "columns"],
    queryFn: () => getBoardColumns(boardId!),
    enabled: !!boardId,
  });

  const labelsQuery = useQuery({
    queryKey: ["boards", boardId, "labels"],
    queryFn: () => getBoardLabels(boardId!),
    enabled: !!boardId,
  });

  function updateBoardTaskLabels(transform: (labels: Label[]) => Label[]) {
    if (!boardId) return;
    queryClient
      .getQueryCache()
      .findAll({ queryKey: ["boards", boardId, "columns"] })
      .filter(
        (query) => query.queryKey.length === 5 && query.queryKey[4] === "tasks",
      )
      .forEach((query) => {
        queryClient.setQueryData<Task[]>(query.queryKey, (old) =>
          old
            ? old.map((task) => ({
                ...task,
                labels: transform(task.labels ?? []),
              }))
            : old,
        );
      });
  }

  function invalidateBoardTasks() {
    if (!boardId) return;
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey.length === 5 &&
        query.queryKey[0] === "boards" &&
        query.queryKey[1] === boardId &&
        query.queryKey[4] === "tasks",
    });
  }

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
    }) => {
      const currentColumn = queryClient
        .getQueryData<Column[]>(["boards", boardId, "columns"])
        ?.find((column) => column.id === columnId);
      if (!currentColumn) {
        throw new Error("Column is no longer available.");
      }
      return updateColumn(columnId, { ...data, version: currentColumn.version });
    },
    onSuccess: (updatedColumn) => {
      queryClient.setQueryData<Column[]>(
        ["boards", boardId, "columns"],
        (old) =>
          old
            ? old.map((c) => (c.id === updatedColumn.id ? updatedColumn : c))
            : [updatedColumn],
      );
    },
    onSettled: () => {
      if (!boardId) return;
      queryClient.invalidateQueries({
        queryKey: ["boards", boardId, "columns"],
      });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (columnId: string) => {
      const currentColumn = queryClient
        .getQueryData<Column[]>(["boards", boardId, "columns"])
        ?.find((column) => column.id === columnId);
      if (!currentColumn) {
        throw new Error("Column is no longer available.");
      }
      return deleteColumn(columnId, currentColumn.version);
    },
    onSuccess: (_data, deletedColumnId) => {
      queryClient.setQueryData<Column[]>(
        ["boards", boardId, "columns"],
        (old) => (old ? old.filter((c) => c.id !== deletedColumnId) : []),
      );
      // Tasks cascade-delete on the server; drop the column's task cache.
      if (boardId) {
        queryClient.removeQueries({
          queryKey: ["boards", boardId, "columns", deletedColumnId, "tasks"],
        });
      }
    },
    onError: (error) => {
      if (boardId && isStaleError(error)) {
        queryClient.invalidateQueries({
          queryKey: ["boards", boardId, "columns"],
        });
      }
    },
  });

  const updateColumnPositionMutation = useMutation({
    mutationFn: ({
      columnId,
      position,
      version,
    }: {
      columnId: string;
      position: number;
    }) => {
      const currentColumn = queryClient
        .getQueryData<Column[]>(["boards", boardId, "columns"])
        ?.find((column) => column.id === columnId);
      if (!currentColumn) {
        throw new Error("Column is no longer available.");
      }
      return updateColumnPosition(
        columnId,
        position,
        currentColumn.version,
      );
    },
    onMutate: async ({ columnId, position }) => {
      if (boardId) {
        boardMovePredecessors.set(
          boardId,
          boardMoveGatePromises.get(boardId) ?? Promise.resolve(),
        );
      }

      await queryClient.cancelQueries({
        queryKey: ["boards", boardId, "columns"],
      });

      const previousColumns =
        queryClient.getQueryData<Column[]>(["boards", boardId, "columns"]) ??
        [];

      const gate = createColumnMoveGate();
      if (boardId) boardMoveGatePromises.set(boardId, gate.settled);

      queryClient.setQueryData<Column[]>(
        ["boards", boardId, "columns"],
        (old) => (old ? reorderColumns(old, columnId, position) : old),
      );

      return { previousColumns, gate };
    },
    onSuccess: (updatedColumn) => {
      // Authoritative response — write position/version back (never a local +1) so a queued second drop reads the fresh version before any refetch lands.
      queryClient.setQueryData<Column[]>(
        ["boards", boardId, "columns"],
        (old) =>
          old?.map((column) =>
            column.id === updatedColumn.id ? updatedColumn : column,
          ) ?? old,
      );
    },
    onError: (_err, _vars, context) => {
      if (context?.previousColumns) {
        queryClient.setQueryData<Column[]>(
          ["boards", boardId, "columns"],
          context.previousColumns,
        );
      }
    },
    onSettled: async (_data, _error, _variables, context) => {
      await queryClient.refetchQueries({
        queryKey: ["boards", boardId, "columns"],
      });
      context?.gate?.release();
      if (
        context?.gate &&
        boardId &&
        boardMoveGatePromises.get(boardId) === context.gate.settled
      ) {
        boardMoveGatePromises.delete(boardId);
      }
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      createLabel(boardId!, data),
    onSuccess: (newLabel) => {
      queryClient.setQueryData<Label[]>(["boards", boardId, "labels"], (old) =>
        old ? [...old, newLabel] : [newLabel],
      );
    },
  });

  const updateLabelMutation = useMutation({
    mutationFn: ({
      labelId,
      data,
    }: {
      labelId: string;
      data: { name: string; color: string };
    }) => updateLabel(labelId, data),
    onMutate: async ({ labelId, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["boards", boardId, "labels"],
      });

      const previousLabels =
        queryClient.getQueryData<Label[]>(["boards", boardId, "labels"]) ?? [];

      queryClient.setQueryData<Label[]>(
        ["boards", boardId, "labels"],
        (old) =>
          old?.map((label) =>
            label.id === labelId ? { ...label, ...data } : label,
          ) ?? [],
      );

      updateBoardTaskLabels((labels) =>
        labels.map((label) =>
          label.id === labelId ? { ...label, ...data } : label,
        ),
      );

      return { previousLabels };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData<Label[]>(
          ["boards", boardId, "labels"],
          context.previousLabels,
        );
      }
      invalidateBoardTasks();
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["boards", boardId, "labels"],
      });
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: string) => deleteLabel(labelId),
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({
        queryKey: ["boards", boardId, "labels"],
      });

      const previousLabels =
        queryClient.getQueryData<Label[]>(["boards", boardId, "labels"]) ?? [];

      queryClient.setQueryData<Label[]>(["boards", boardId, "labels"], (old) =>
        old ? old.filter((label) => label.id !== labelId) : [],
      );

      updateBoardTaskLabels((labels) =>
        labels.filter((label) => label.id !== labelId),
      );

      return { previousLabels };
    },
    onError: (_err, _labelId, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData<Label[]>(
          ["boards", boardId, "labels"],
          context.previousLabels,
        );
      }
      invalidateBoardTasks();
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["boards", boardId, "labels"],
      });
    },
  });

  return {
    board: boardQuery.data,
    isLoadingBoard: boardQuery.isLoading,
    isBoardError: boardQuery.isError,
    boardError: boardQuery.error,
    refetchBoard: boardQuery.refetch,
    refetchColumns: columnsQuery.refetch,
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
    labels: labelsQuery.data ?? [],
    isLoadingLabels: labelsQuery.isLoading,
    isLabelsError: labelsQuery.isError,
    labelsError: labelsQuery.error,
    createLabel: createLabelMutation.mutateAsync,
    isCreatingLabel: createLabelMutation.isPending,
    updateLabel: updateLabelMutation.mutateAsync,
    isUpdatingLabel: updateLabelMutation.isPending,
    deleteLabel: deleteLabelMutation.mutateAsync,
    isDeletingLabel: deleteLabelMutation.isPending,
  };
}
