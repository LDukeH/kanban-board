import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  getColumnTasks,
  updateTask,
  updateTaskPosition,
  type CreateTaskData,
  type UpdateTaskData,
} from "@/lib/api/task.api";
import { addLabelToTask, removeLabelFromTask } from "@/lib/api/label.api";
import { boardLabelsQueryKey } from "@/hooks/useBoard";
import {
  insertTaskIntoColumn,
  orderTasksByPosition,
  removeTaskFromColumn,
} from "@/lib/dragDrop";
import type { Label, Task } from "@/types/board";

type PendingTaskMove = {
  boardId: string;
  task: Task;
  sourceColumnId: string;
  targetColumnId: string;
  position: number;
};

// In-flight position moves, kept per task so a refetch resolving before the PATCH cannot clobber an optimistic placement.
const pendingTaskMoves = new Map<string, PendingTaskMove>();

// Durable copy so a drop that already looked successful is re-applied if the page reloads before the PATCH finishes.
const PENDING_TASK_MOVE_STORAGE_KEY = "kanban-pending-task-moves";
const REPLAYING_BOARDS = new Set<string>();

type StoredTaskMove = {
  boardId: string;
  taskId: string;
  /** Present on saved moves; omitted when recomputing which entry to remove. */
  sourceColumnId?: string;
  targetColumnId: string;
  position: number;
  // Full task snapshot at drop time so a reloaded page can rebuild the card before any GET returns it.
  task?: Task;
};

function readStoredTaskMoves(): StoredTaskMove[] {
  try {
    const stored = sessionStorage.getItem(PENDING_TASK_MOVE_STORAGE_KEY);
    if (!stored) return [];
    const moves = JSON.parse(stored) as unknown;
    return Array.isArray(moves) ? (moves as StoredTaskMove[]) : [];
  } catch {
    return [];
  }
}

function writeStoredTaskMoves(moves: StoredTaskMove[]) {
  try {
    if (moves.length === 0) {
      sessionStorage.removeItem(PENDING_TASK_MOVE_STORAGE_KEY);
    } else {
      sessionStorage.setItem(PENDING_TASK_MOVE_STORAGE_KEY, JSON.stringify(moves));
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function savePendingTaskMove(move: StoredTaskMove) {
  const moves = readStoredTaskMoves().filter(
    (storedMove) => storedMove.taskId !== move.taskId,
  );
  writeStoredTaskMoves([...moves, move]);
}

function removePendingTaskMove(move: StoredTaskMove) {
  writeStoredTaskMoves(
    readStoredTaskMoves().filter(
      (storedMove) =>
        storedMove.taskId !== move.taskId ||
        storedMove.boardId !== move.boardId ||
        storedMove.targetColumnId !== move.targetColumnId ||
        storedMove.position !== move.position,
    ),
  );
}

// Rebuilds the in-memory move map from the durable copy on (re)load; without it a refresh before the PATCH lands paints the task at its old spot.
function hydratePendingTaskMoves(): void {
  for (const move of readStoredTaskMoves()) {
    if (!move.task || !move.sourceColumnId || !move.targetColumnId) continue;
    pendingTaskMoves.set(move.taskId, {
      boardId: move.boardId,
      task: move.task,
      sourceColumnId: move.sourceColumnId,
      targetColumnId: move.targetColumnId,
      position: move.position,
    });
  }
}

hydratePendingTaskMoves();

export function columnTasksQueryKey(boardId: string, columnId: string) {
  return ["boards", boardId, "columns", columnId, "tasks"] as const;
}

/** The single implementation behind a column's task query, exported so another observer of the same key (see useBoardSummary) runs the identical reconciliation. */
export function columnTasksQueryFn(
  boardId: string | undefined,
  columnId: string | undefined,
): () => Promise<Task[]> {
  return async () => {
    const serverTasks = await getColumnTasks(columnId!);
    const moves = [...pendingTaskMoves.entries()].filter(
      ([, move]) => move.boardId === boardId,
    );

    let tasks = orderTasksByPosition(serverTasks);

    for (const [taskId, move] of moves) {
      const destinationConfirmed =
        move.targetColumnId === columnId &&
        serverTasks.some((task) => task.id === taskId);

      if (move.sourceColumnId === columnId) {
        tasks = removeTaskFromColumn(tasks, taskId);
      }
      if (move.targetColumnId === columnId) {
        tasks = insertTaskIntoColumn(
          tasks,
          { ...move.task, columnId: columnId! },
          columnId!,
          move.position,
        );
      }

      if (destinationConfirmed) {
        pendingTaskMoves.delete(taskId);
      }
    }

    return tasks;
  };
}

export function useColumnTasks(
  boardId: string | undefined,
  columnId: string | undefined,
) {
  const queryClient = useQueryClient();
  const enabled = !!boardId && !!columnId;
  const queryKey =
    boardId && columnId
      ? columnTasksQueryKey(boardId, columnId)
      : (["boards", "unknown", "columns", "unknown", "tasks"] as const);

  // Re-apply position PATCHes still in flight when the page loaded; runs once per board via the REPLAYING_BOARDS guard.
  useEffect(() => {
    if (!boardId || REPLAYING_BOARDS.has(boardId)) return;

    REPLAYING_BOARDS.add(boardId);
    const moves = readStoredTaskMoves().filter(
      (move) =>
        move.boardId === boardId &&
        move.sourceColumnId &&
        move.targetColumnId,
    );

    void Promise.all(
      moves.map(async (move) => {
        try {
          await updateTaskPosition(move.taskId, {
            columnId: move.targetColumnId,
            position: move.position,
          });
          removePendingTaskMove(move);
        } catch {
          // Keep failed moves queued for the next board load.
        }
      }),
    ).finally(() => {
      REPLAYING_BOARDS.delete(boardId);
    });
  }, [boardId]);

  const tasksQuery = useQuery({
    queryKey,
    queryFn: columnTasksQueryFn(boardId, columnId),
    enabled,
  });
  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskData) =>
      createTask(columnId!, data),
    onSuccess: (newTask) => {
      if (!boardId || !columnId) return;
      // Optimistic append; invalidate because the create response may omit the server-assigned position.
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, columnId),
        (old) => (old ? [...old, newTask] : [newTask]),
      );
      queryClient.invalidateQueries({
        queryKey: columnTasksQueryKey(boardId, columnId),
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: string;
      data: UpdateTaskData;
    }) => updateTask(taskId, data),
    onSuccess: (_void, { taskId, data }) => {
      if (!boardId || !columnId) return;
      // PATCH answers 204 with no body, so the sent fields are merged into the cached task instead of re-fetching.
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, columnId),
        (old) =>
          old
            ? old.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      ...(data.title !== undefined
                        ? { title: data.title }
                        : {}),
                      ...(data.description !== undefined
                        ? { description: data.description }
                        : {}),
                      ...(data.priority !== undefined
                        ? { priority: data.priority }
                        : {}),
                      ...(data.dueDate !== undefined
                        ? { dueDate: data.dueDate }
                        : {}),
                      ...(data.completed !== undefined
                        ? { completed: data.completed }
                        : {}),
                    }
                  : task,
              )
            : old,
      );
    },
  });

  const updateTaskPositionMutation = useMutation({
    mutationKey: ["updateTaskPosition", boardId],
    mutationFn: ({
      taskId,
      columnId: targetColumnId,
      position,
    }: {
      taskId: string;
      sourceColumnId?: string;
      columnId: string;
      position: number;
    }) => {
      return updateTaskPosition(taskId, {
        columnId: targetColumnId,
        position,
      });
    },

    onMutate: async ({
      taskId,
      sourceColumnId: paramSourceId,
      columnId: targetColumnId,
      position,
    }) => {
      if (!boardId) return;

      const sourceColumnId = paramSourceId ?? columnId;
      if (!sourceColumnId) return;

      // Stop in-flight fetches so they cannot overwrite the optimistic lists.
      await queryClient.cancelQueries({
        queryKey: columnTasksQueryKey(boardId, sourceColumnId),
      });
      if (targetColumnId !== sourceColumnId) {
        await queryClient.cancelQueries({
          queryKey: columnTasksQueryKey(boardId, targetColumnId),
        });
      }

      // Snapshot the currently cached lists (already ordered by position).
      const previousSource = orderTasksByPosition(
        queryClient.getQueryData<Task[]>(
          columnTasksQueryKey(boardId, sourceColumnId),
        ) ?? [],
      );
      const previousTarget =
        sourceColumnId === targetColumnId
          ? previousSource
          : orderTasksByPosition(
              queryClient.getQueryData<Task[]>(
                columnTasksQueryKey(boardId, targetColumnId),
              ) ?? [],
            );

      const movingTask = previousSource.find((task) => task.id === taskId);
      if (!movingTask) return;

      // Remember the move so a reload / refetch can replay or reconcile it.
      savePendingTaskMove({
        boardId,
        taskId,
        sourceColumnId,
        targetColumnId,
        position,
        task: movingTask,
      });

      if (sourceColumnId === targetColumnId) {
        const updated = insertTaskIntoColumn(
          previousSource,
          movingTask,
          targetColumnId,
          position,
        );
        queryClient.setQueryData<Task[]>(
          columnTasksQueryKey(boardId, sourceColumnId),
          updated,
        );
      } else {
        queryClient.setQueryData<Task[]>(
          columnTasksQueryKey(boardId, sourceColumnId),
          removeTaskFromColumn(previousSource, taskId),
        );
        queryClient.setQueryData<Task[]>(
          columnTasksQueryKey(boardId, targetColumnId),
          insertTaskIntoColumn(
            previousTarget,
            movingTask,
            targetColumnId,
            position,
          ),
        );
      }

      // Track same-column reorders and cross-column moves alike so any query resolving before the PATCH lands reconciles the task (fresh loads included, via hydration).
      pendingTaskMoves.set(taskId, {
        boardId,
        task: movingTask,
        sourceColumnId,
        targetColumnId,
        position,
      });

      return { previousSource, previousTarget, sourceColumnId, targetColumnId };
    },

    onSuccess: (_data, variables, context) => {
      if (!boardId) return;

      const sourceColumnId =
        variables.sourceColumnId ?? context?.sourceColumnId ?? columnId;
      const targetColumnId = variables.columnId;

      // The position endpoint returns 204, so keep the optimistic task in the destination cache rather than letting a pre-PATCH GET empty it.
      if (
        targetColumnId &&
        sourceColumnId &&
        targetColumnId !== sourceColumnId &&
        context
      ) {
        const movedTask = context.previousSource.find(
          (task) => task.id === variables.taskId,
        );

        if (movedTask) {
          queryClient.setQueryData<Task[]>(
            columnTasksQueryKey(boardId, targetColumnId),
            (current = []) =>
              insertTaskIntoColumn(
                current,
                movedTask,
                targetColumnId,
                variables.position,
              ),
          );
        }
      }

      if (sourceColumnId) {
        queryClient.invalidateQueries({
          queryKey: columnTasksQueryKey(boardId, sourceColumnId),
          refetchType: "none",
        });
      }
      if (targetColumnId && targetColumnId !== sourceColumnId) {
        queryClient.invalidateQueries({
          queryKey: columnTasksQueryKey(boardId, targetColumnId),
          refetchType: "none",
        });
      }

      removePendingTaskMove({
        boardId,
        taskId: variables.taskId,
        targetColumnId,
        position: variables.position,
      });
    },

    onError: (_err, _vars, context) => {
      if (!boardId || !context) return;
      pendingTaskMoves.delete(_vars.taskId);
      removePendingTaskMove({
        boardId,
        taskId: _vars.taskId,
        targetColumnId: _vars.columnId,
        position: _vars.position,
      });
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, context.sourceColumnId),
        context.previousSource,
      );
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, context.targetColumnId),
        context.previousTarget,
      );
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: (_void, taskId) => {
      if (!boardId || !columnId) return;
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, columnId),
        (old) => (old ? old.filter((task) => task.id !== taskId) : []),
      );
    },
  });

  const addLabelToTaskMutation = useMutation({
    mutationFn: ({ taskId, labelId }: { taskId: string; labelId: string }) =>
      addLabelToTask(taskId, labelId),
    onSuccess: (_void, { taskId, labelId }) => {
      if (!boardId || !columnId) return;
      // Attach the resolved label object (from the board-labels cache) so the UI updates without a refetch.
      const label = queryClient
        .getQueryData<Label[]>(boardLabelsQueryKey(boardId))
        ?.find((l) => l.id === labelId);
      if (label) {
        queryClient.setQueryData<Task[]>(
          columnTasksQueryKey(boardId, columnId),
          (old) =>
            old?.map((task) =>
              task.id === taskId &&
              !(task.labels ?? []).some((l) => l.id === labelId)
                ? { ...task, labels: [...(task.labels ?? []), label] }
                : task,
            ) ?? [],
        );
      }
      // Refetch to guarantee server-side truth (matches createTask pattern).
      queryClient.invalidateQueries({
        queryKey: columnTasksQueryKey(boardId, columnId),
      });
    },
  });

  const removeLabelFromTaskMutation = useMutation({
    mutationFn: ({ taskId, labelId }: { taskId: string; labelId: string }) =>
      removeLabelFromTask(taskId, labelId),
    onSuccess: (_void, { taskId, labelId }) => {
      if (!boardId || !columnId) return;
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, columnId),
        (old) =>
          old?.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  labels: (task.labels ?? []).filter((l) => l.id !== labelId),
                }
              : task,
          ) ?? [],
      );
      queryClient.invalidateQueries({
        queryKey: columnTasksQueryKey(boardId, columnId),
      });
    },
  });

  const tasks = orderTasksByPosition(tasksQuery.data ?? []);

  return {
    tasks,
    isLoadingTasks: tasksQuery.isLoading,
    isTasksError: tasksQuery.isError,
    tasksError: tasksQuery.error,
    refetchTasks: tasksQuery.refetch,
    createTask: createTaskMutation.mutateAsync,
    isCreatingTask: createTaskMutation.isPending,
    updateTask: updateTaskMutation.mutateAsync,
    isUpdatingTask: updateTaskMutation.isPending,
    updateTaskPosition: updateTaskPositionMutation.mutateAsync,
    isUpdatingTaskPosition: updateTaskPositionMutation.isPending,
    deleteTask: deleteTaskMutation.mutateAsync,
    isDeletingTask: deleteTaskMutation.isPending,
    addLabelToTask: addLabelToTaskMutation.mutateAsync,
    isAssigningLabel: addLabelToTaskMutation.isPending,
    removeLabelFromTask: removeLabelFromTaskMutation.mutateAsync,
    isRemovingLabel: removeLabelFromTaskMutation.isPending,
  };
}
