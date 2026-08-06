import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  getColumnTasks,
  updateTask,
} from "@/lib/api/task.api";
import type { Task } from "@/types/board";

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
    deleteTask: deleteTaskMutation.mutateAsync,
    isDeletingTask: deleteTaskMutation.isPending,
  };
}
