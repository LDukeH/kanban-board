import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  getColumnTasks,
  updateTask,
  updateTaskPosition,
} from "@/lib/api/task.api";
import { addLabelToTask, removeLabelFromTask } from "@/lib/api/label.api";
import { boardLabelsQueryKey } from "@/hooks/useBoard";
import type { Label, Task } from "@/types/board";

type PendingTaskMove = {
  boardId: string;
  task: Task;
  sourceColumnId: string;
  targetColumnId: string;
  position: number;
};

const pendingTaskMoves = new Map<string, PendingTaskMove>();

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

  const tasksQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const serverTasks = await getColumnTasks(columnId!);
      const moves = [...pendingTaskMoves.entries()].filter(
        ([, move]) => move.boardId === boardId,
      );
      let tasks = serverTasks;

      for (const [taskId, move] of moves) {
        const destinationConfirmed =
          move.targetColumnId === columnId &&
          serverTasks.some((task) => task.id === taskId);

        if (move.sourceColumnId === columnId) {
          tasks = tasks.filter((task) => task.id !== taskId);
        }
        if (move.targetColumnId === columnId) {
          const withoutTask = tasks.filter((task) => task.id !== taskId);
          withoutTask.splice(Math.min(move.position, withoutTask.length), 0, {
            ...move.task,
            columnId: columnId!,
            position: move.position,
          });
          tasks = withoutTask.map((task, index) => ({
            ...task,
            position: index,
          }));
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
    mutationFn: (data: { title: string; description?: string }) =>
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
      data: { title?: string; description?: string };
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
                      updatedAt: new Date().toISOString(),
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

      void queryClient.cancelQueries({
        queryKey: columnTasksQueryKey(boardId, sourceColumnId),
      });
      void queryClient.cancelQueries({
        queryKey: columnTasksQueryKey(boardId, targetColumnId),
      });

      const previousSource = (
        queryClient.getQueryData<Task[]>(
          columnTasksQueryKey(boardId, sourceColumnId),
        ) ?? []
      )
        .slice()
        .sort((a, b) => a.position - b.position);
      const previousTarget =
        sourceColumnId === targetColumnId
          ? previousSource
          : (
              queryClient.getQueryData<Task[]>(
                columnTasksQueryKey(boardId, targetColumnId),
              ) ?? []
            )
              .slice()
              .sort((a, b) => a.position - b.position);

      const movingTask = previousSource.find((task) => task.id === taskId);
      if (!movingTask) return;

      if (sourceColumnId !== targetColumnId) {
        pendingTaskMoves.set(taskId, {
          boardId,
          task: movingTask,
          sourceColumnId,
          targetColumnId,
          position,
        });
      }

      if (sourceColumnId === targetColumnId) {
        const updated = previousSource.filter((t) => t.id !== taskId);
        const nextIndex = Math.min(position, updated.length);
        updated.splice(nextIndex, 0, movingTask);

        queryClient.setQueryData<Task[]>(
          columnTasksQueryKey(boardId, sourceColumnId),
          updated.map((task, index) => ({ ...task, position: index })),
        );
      } else {
        const sourceUpdated = previousSource.filter((t) => t.id !== taskId);
        queryClient.setQueryData<Task[]>(
          columnTasksQueryKey(boardId, sourceColumnId),
          sourceUpdated.map((task, index) => ({ ...task, position: index })),
        );

        const targetUpdated = previousTarget.filter((t) => t.id !== taskId);
        const nextIndex = Math.min(position, targetUpdated.length);
        targetUpdated.splice(nextIndex, 0, {
          ...movingTask,
          columnId: targetColumnId,
        });

        queryClient.setQueryData<Task[]>(
          columnTasksQueryKey(boardId, targetColumnId),
          targetUpdated.map((task, index) => ({ ...task, position: index })),
        );
      }

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
            (current = []) => {
              const withoutMovedTask = current.filter(
                (task) => task.id !== movedTask.id,
              );
              withoutMovedTask.splice(
                Math.min(variables.position, withoutMovedTask.length),
                0,
                {
                  ...movedTask,
                  columnId: targetColumnId,
                  position: variables.position,
                },
              );
              return withoutMovedTask.map((task, index) => ({
                ...task,
                position: index,
              }));
            },
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
    },

    onError: (_err, _vars, context) => {
      if (!boardId || !context) return;
      pendingTaskMoves.delete(_vars.taskId);
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
