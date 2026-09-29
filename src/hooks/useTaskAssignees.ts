import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignUserToTask,
  getTaskAssignees,
  unassignUserFromTask,
} from "@/lib/api/task.api";
import { columnTasksQueryKey } from "@/hooks/useColumnTasks";

export function taskAssigneesQueryKey(taskId: string) {
  return ["tasks", taskId, "assignees"] as const;
}

interface UseTaskAssigneesOptions {
  boardId?: string;
  columnId?: string;
}

export function useTaskAssignees(
  taskId: string | undefined,
  options?: UseTaskAssigneesOptions,
) {
  const queryClient = useQueryClient();

  const queryKey =
    taskId && taskId.length > 0
      ? taskAssigneesQueryKey(taskId)
      : (["tasks", "unknown", "assignees"] as const);

  const assigneesQuery = useQuery({
    queryKey,
    queryFn: () => getTaskAssignees(taskId!),
    enabled: !!taskId,
  });

  const invalidateAssignees = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  // Task cards read assignees from the embedded column task list, so keep that list in sync too.
  const invalidateEmbeddedTask = () => {
    if (!options?.boardId || !options?.columnId) return;
    queryClient.invalidateQueries({
      queryKey: columnTasksQueryKey(options.boardId, options.columnId),
    });
  };

  const assignUserMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      assignUserToTask(taskId!, userId),
    onSuccess: () => {
      invalidateAssignees();
      invalidateEmbeddedTask();
    },
  });

  const unassignUserMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      unassignUserFromTask(taskId!, userId),
    onSuccess: () => {
      invalidateAssignees();
      invalidateEmbeddedTask();
    },
  });

  return {
    assignees: assigneesQuery.data ?? [],
    isLoadingAssignees: assigneesQuery.isLoading,
    isAssigneesError: assigneesQuery.isError,
    assigneesError: assigneesQuery.error,
    assignUser: assignUserMutation.mutateAsync,
    isAssigningUser: assignUserMutation.isPending,
    unassignUser: unassignUserMutation.mutateAsync,
    isUnassigningUser: unassignUserMutation.isPending,
  };
}
