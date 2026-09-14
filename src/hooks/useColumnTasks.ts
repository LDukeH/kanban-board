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

// In-memory record of position moves that are still being confirmed by the
// server. Kept per task (a task only ever has one in-flight move) so a refetch
// that resolves before the PATCH lands cannot clobber an optimistically placed
// task. Used by the query functions to reconcile server responses.
const pendingTaskMoves = new Map<string, PendingTaskMove>();

// Durable copy of in-flight positions so a drop that already looked successful
// is re-applied if the page is (re)loaded before the PATCH finishes.
const pendingTaskMoveStorageKey = "kanban-pending-task-moves";
const replayingBoards = new Set<string>();

type StoredTaskMove = {
  boardId: string;
  taskId: string;
  /** Present on saved moves; omitted when recomputing which entry to remove. */
  sourceColumnId?: string;
  targetColumnId: string;
  position: number;
  /** Full task snapshot at drop time so a reloaded page can rebuild the
   * optimistically placed card even before any GET returns it. */
  task?: Task;
};

function readStoredTaskMoves(): StoredTaskMove[] {
  try {
    const stored = sessionStorage.getItem(pendingTaskMoveStorageKey);
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
      sessionStorage.removeItem(pendingTaskMoveStorageKey);
    } else {
      sessionStorage.setItem(pendingTaskMoveStorageKey, JSON.stringify(moves));
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

// Rebuild the in-memory pending-move map from the durable sessionStorage copy
// on (re)load. Without this, a page refreshed before a position PATCH lands
// would paint the task at its old spot (while the DB ends up updated) until a
// later refetch happened to agree with the server.
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

  // Re-apply position PATCHes that were still in flight when the page was
  // (re)loaded. Runs once per board thanks to the replayingBoards guard.
  useEffect(() => {
    if (!boardId || replayingBoards.has(boardId)) return;

    replayingBoards.add(boardId);
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
      replayingBoards.delete(boardId);
    });
  }, [boardId]);

  const tasksQuery = useQuery({
    queryKey,
    queryFn: async () => {
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
    },
    enabled,
  });
  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskData) =>
      createTask(columnId!, data),
    onSuccess: (newTask) => {
      if (!boardId || !columnId) return;
      // Optimistic append for snappy UI; invalidate because create response
      // may omit the server-assigned position.
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
      // Start the PATCH immediately. Optimistic cache updates happen in
      // onMutate and do not need to block this request.
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

      // Track the move for both same-column reorders and cross-column moves so
      // any query that resolves before the PATCH lands reconciles the task to
      // its intended position (fresh page loads included, via hydration).
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

      // The position endpoint returns 204, so keep the successful optimistic
      // task in the destination cache. In particular, do not let a GET that
      // started before the PATCH completed replace an empty destination list.
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
      // Attach the resolved label object (read from the board-labels cache) to
      // the task so the UI updates immediately without a refetch.
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

  const tasks = [...(tasksQuery.data ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  return {
    tasks,
    isLoadingTasks: tasksQuery.isLoading,
    isTasksError: tasksQuery.isError,
    tasksError: tasksQuery.error,
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
