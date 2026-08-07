import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  getColumnTasks,
  updateTask,
  updateTaskPosition,
} from "@/lib/api/task.api";
import type { Task } from "@/types/board";

// Using queue so that multiple position updates are applied in order, to avoid race conditions.
let positionUpdateQueue: Promise<unknown> = Promise.resolve();

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
    queryFn: () => getColumnTasks(columnId!),
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
      // Append request to queue so backend handles updates sequentially
      const nextRequest = () =>
        updateTaskPosition(taskId, { columnId: targetColumnId, position });

      positionUpdateQueue = positionUpdateQueue.then(nextRequest, nextRequest);
      return positionUpdateQueue as Promise<
        ReturnType<typeof updateTaskPosition>
      >;
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

      await queryClient.cancelQueries({
        queryKey: columnTasksQueryKey(boardId, sourceColumnId),
      });
      await queryClient.cancelQueries({
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

    onError: (_err, _vars, context) => {
      if (!boardId || !context) return;
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, context.sourceColumnId),
        context.previousSource,
      );
      queryClient.setQueryData<Task[]>(
        columnTasksQueryKey(boardId, context.targetColumnId),
        context.previousTarget,
      );
    },

    onSettled: (_data, _error, variables, context) => {
      if (!boardId) return;

      const activeMutations = queryClient.isMutating({
        mutationKey: ["updateTaskPosition", boardId],
      });

      // Refetch from server only when all queued moves have completed
      if (activeMutations > 1) return;

      const sourceColumnId =
        variables.sourceColumnId ?? context?.sourceColumnId ?? columnId;
      const targetColumnId = variables.columnId;

      if (sourceColumnId) {
        queryClient.invalidateQueries({
          queryKey: columnTasksQueryKey(boardId, sourceColumnId),
        });
      }
      if (targetColumnId && targetColumnId !== sourceColumnId) {
        queryClient.invalidateQueries({
          queryKey: columnTasksQueryKey(boardId, targetColumnId),
        });
      }
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
  };
}
