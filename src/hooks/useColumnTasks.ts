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
import { isConflictError, isStaleError } from "@/lib/httpStatus";
import { writeStaleMoveNotice } from "@/lib/staleMoveNotices";
import {
  insertTaskIntoColumn,
  orderTasksByPosition,
  removeTaskFromColumn,
} from "@/lib/dragDrop";
import {
  columnGateKey,
  touchedColumnGateKeys,
} from "@/lib/taskMove";
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

// Per-task move queue: onMutate records the predecessor gate, mutationFn waits on it before PATCHing, and onSettled releases it — a rapid re-drag never re-sends the version move 1 already bumped (self-409).
const taskMoveGatePromises = new Map<string, Promise<boolean>>();
const taskMovePredecessors = new Map<string, Promise<boolean>>();

// Per-column move queue: the backend bumps versions of every shifted neighbor,
// so two different tasks in the same column must not PATCH concurrently. A move
// waits for the previous move touching its source/target columns to settle AND
// refetch, otherwise the second move reads a stale neighbor version (neighbor-409).
const columnMoveGatePromises = new Map<string, Promise<boolean>>();
const columnMovePredecessors = new Map<string, Promise<boolean>[]>();

function createTaskMoveGate() {
  let release!: (ready?: boolean) => void;
  const settled = new Promise<boolean>((resolve) => {
    release = (ready = true) => {
      resolve(ready);
    };
  });
  return { settled, release };
}

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

function findCachedTask(
  queryClient: ReturnType<typeof useQueryClient>,
  boardId: string,
  taskId: string,
): Task | undefined {
  for (const [, tasks] of queryClient.getQueriesData<Task[]>({
    queryKey: ["boards", boardId, "columns"],
  })) {
    const task = tasks?.find((candidate) => candidate.id === taskId);
    if (task) return task;
  }
  return undefined;
}

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
      sessionStorage.setItem(
        PENDING_TASK_MOVE_STORAGE_KEY,
        JSON.stringify(moves),
      );
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

/**
 * Re-applies position PATCHes saved before the page loaded. Exported so tests can drive the
 * replay — including the drop-on-409 path — without rendering React; the REPLAYING_BOARDS
 * guard keeps it running once per board.
 */
export async function replayStoredTaskMoves(boardId: string): Promise<void> {
  if (REPLAYING_BOARDS.has(boardId)) return;

  REPLAYING_BOARDS.add(boardId);
  const moves = readStoredTaskMoves().filter(
    (move) =>
      move.boardId === boardId && move.sourceColumnId && move.targetColumnId,
  );

  try {
    // Replays must be sequential. A successful reorder bumps the versions of
    // neighboring tasks, so parallel replays can invalidate each other.
    for (const move of moves) {
      try {
        const [sourceTasks, targetTasks] = await Promise.all([
          getColumnTasks(move.sourceColumnId!),
          move.sourceColumnId === move.targetColumnId
            ? Promise.resolve([])
            : getColumnTasks(move.targetColumnId),
        ]);
        const currentTask =
          targetTasks.find((task) => task.id === move.taskId) ??
          sourceTasks.find((task) => task.id === move.taskId);

        await updateTaskPosition(move.taskId, {
          columnId: move.targetColumnId,
          position: move.position,
          // Prefer the latest server version; the snapshot is only a fallback
          // for a legacy entry whose columns are not currently readable.
          version: currentTask?.version ?? move.task?.version ?? 1,
        });
        removePendingTaskMove(move);
      } catch (error) {
        if (isStaleError(error)) {
          // The queued drop can never succeed (the board moved on in another session) — drop it so it stops replaying, and tell the user on next paint.
          pendingTaskMoves.delete(move.taskId);
          removePendingTaskMove(move);
          writeStaleMoveNotice(
            boardId,
            "A move from before your last reload was discarded because the board changed in another session.",
          );
        }
        // Non-stale failures stay queued for the next board load.
      }
    }
  } finally {
    REPLAYING_BOARDS.delete(boardId);
  }
}

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

  // Re-apply position PATCHes still in flight when the page loaded (the helper owns the once-per-board guard).
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
            version: move.task?.version ?? 1,
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
    mutationFn: (data: CreateTaskData) => createTask(columnId!, data),
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
    }) => {
      const task = findCachedTask(queryClient, boardId!, taskId);
      if (!task) throw new Error(`Task ${taskId} is not available for update.`);
      return updateTask(taskId, { ...data, version: task.version });
    },
    onSuccess: (_void, { taskId, data }) => {
      if (!boardId || !columnId) return;
      // Authoritative response — write the whole task (version included) so a
      // follow-up move sends the fresh version instead of the pre-edit one.
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, columnId),
        (old) =>
          old?.map((task) => (task.id === taskId ? updatedTask : task)) ?? [],
      );
    },
  });

  const updateTaskPositionMutation = useMutation({
    mutationKey: ["updateTaskPosition", boardId],
    mutationFn: ({
      taskId,
      sourceColumnId,
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
        version:
          findCachedTask(queryClient, boardId!, taskId)?.version ??
          (() => {
            throw new Error(`Task ${taskId} is not available for repositioning.`);
          })(),
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

      // Queue behind any in-flight move of the same task; mutationFn waits on this before PATCHing so it reads the version that move just wrote.
      taskMovePredecessors.set(
        taskId,
        taskMoveGatePromises.get(taskId) ?? Promise.resolve(true),
      );

      // Queue behind any in-flight move touching the same columns; the backend
      // bumps versions of every shifted neighbor, so mutationFn must wait for
      // the previous move's refetch before reading a neighbor's version.
      if (boardId) {
        const touched = touchedColumnGateKeys(boardId, sourceColumnId, targetColumnId);
        columnMovePredecessors.set(
          taskId,
          [...touched].map(
            (key) => columnMoveGatePromises.get(key) ?? Promise.resolve(true),
          ),
        );
      }

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

      const gate = createTaskMoveGate();
      taskMoveGatePromises.set(taskId, gate.settled);
      // Own the column gates now that this move is the latest one touching
      // those columns; the next move waits on them and they open only after
      // this move's refetch lands (see onSettled).
      for (const column of new Set([sourceColumnId, targetColumnId])) {
        columnMoveGatePromises.set(
          columnGateKey(boardId, column),
          gate.settled,
        );
      }

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

      return {
        previousSource,
        previousTarget,
        sourceColumnId,
        targetColumnId,
        gate,
      };
    },

    onSuccess: (moved, variables, context) => {
      if (!boardId) return;

      const sourceColumnId =
        variables.sourceColumnId ?? context?.sourceColumnId ?? columnId;
      const targetColumnId = variables.columnId;
      if (!targetColumnId) return;

      // Record the authoritative response — position/version straight from the server, never a local +1 — so a queued consecutive drag reads the fresh version before any refetch lands.
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, targetColumnId),
        (current = []) => {
          const base =
            current.find((task) => task.id === variables.taskId) ??
            context?.previousSource.find(
              (task) => task.id === variables.taskId,
            );
          if (!base) return current;
          const movedTask: Task = {
            ...base,
            columnId: moved.column_id,
            position: moved.position,
            version: moved.version,
          };
          return insertTaskIntoColumn(
            current.filter((task) => task.id !== variables.taskId),
            movedTask,
            targetColumnId,
            moved.position,
          );
        },
      );
      if (sourceColumnId && sourceColumnId !== targetColumnId) {
        queryClient.setQueryData<Task[]>(
          columnTasksQueryKey(boardId, sourceColumnId),
          (current) =>
            current?.filter((task) => task.id !== variables.taskId) ?? current,
        );
      }

      // Keep a queued follow-up drag's durable snapshot on the new version so a refetch overlay racing it cannot resurrect the pre-move version.
      const pending = pendingTaskMoves.get(variables.taskId);
      if (pending) {
        pending.task = { ...pending.task, version: moved.version };
      }

      // The reorder bumped versions of shifted rows server-side (contract §5.2) —
      // onSettled refetches the touched lists before opening the column gates,
      // so a queued move of a neighbor reads the fresh versions.

      // Only retire this mutation's replay entry; a follow-up drag of the same task may already own it.
      const pendingMove = pendingTaskMoves.get(variables.taskId);
      if (
        pendingMove &&
        pendingMove.targetColumnId === targetColumnId &&
        pendingMove.position === variables.position
      ) {
        pendingTaskMoves.delete(variables.taskId);
        removePendingTaskMove({
          boardId,
          taskId: variables.taskId,
          targetColumnId,
          position: variables.position,
        });
      }
    },

    onError: (error, variables, context) => {
      if (!boardId || !context) return;

      // Retire only this mutation's replay entry — a queued follow-up drag of the same task may already own it.
      const pending = pendingTaskMoves.get(variables.taskId);
      if (
        pending &&
        pending.targetColumnId === variables.columnId &&
        pending.position === variables.position
      ) {
        pendingTaskMoves.delete(variables.taskId);
        removePendingTaskMove({
          boardId,
          taskId: variables.taskId,
          targetColumnId: variables.columnId,
          position: variables.position,
        });
      }

      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, context.sourceColumnId),
        context.previousSource,
      );
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, context.targetColumnId),
        context.previousTarget,
      );

      if (isStaleError(error)) {
        // 409 (version moved on) / 404 (task deleted): the rolled-back snapshot is not the truth either — refetch both lists so the board shows what the server actually has.
        queryClient.invalidateQueries({
          queryKey: columnTasksQueryKey(boardId, context.sourceColumnId),
        });
        if (context.targetColumnId !== context.sourceColumnId) {
          queryClient.invalidateQueries({
            queryKey: columnTasksQueryKey(boardId, context.targetColumnId),
          });
        }
      }
    },

    onSettled: async (_data, _error, variables, context) => {
      // A queued move touching the same columns must read the neighbor
      // versions this reorder just bumped, so refetch the touched lists and
      // only then open the task + column gates.
      const settledBoardId = boardId;
      const touchedColumns = Array.from(
        new Set(
          [
            context?.sourceColumnId,
            context?.targetColumnId,
            variables.sourceColumnId,
            variables.columnId,
          ].filter((columnId): columnId is string => Boolean(columnId)),
        ),
      );
      let refetchError: unknown;
      if (settledBoardId && touchedColumns.length > 0) {
        try {
          await Promise.all(
            touchedColumns.map((columnId) =>
              queryClient.refetchQueries({
                queryKey: columnTasksQueryKey(settledBoardId, columnId),
              }),
            ),
          );
        } catch (error) {
          refetchError = error;
        }
      }
      context?.gate?.release(refetchError === undefined);
      if (
        context?.gate &&
        taskMoveGatePromises.get(variables.taskId) === context.gate.settled
      ) {
        taskMoveGatePromises.delete(variables.taskId);
      }
      if (settledBoardId && context?.gate) {
        for (const columnId of touchedColumns) {
          const key = columnGateKey(settledBoardId, columnId);
          if (columnMoveGatePromises.get(key) === context.gate.settled) {
            columnMoveGatePromises.delete(key);
          }
        }
      }
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => {
      const task = findCachedTask(queryClient, boardId!, taskId);
      if (!task) throw new Error(`Task ${taskId} is not available for deletion.`);
      return deleteTask(taskId, task.version);
    },
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
